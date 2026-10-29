using DeliverDifferent.AccessControl.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;
using SetupDashboard.Models;
using SetupDashboard.Services;
using SetupDashboard.Services.Steps;

namespace SetupDashboard.Controllers;

/// <summary>
/// Smart Import: upload a file, auto-map its columns, preview, then load the rows into the step.
/// </summary>
/// <remarks>
/// <para>Flow: detect → preview → execute → (the step's own Send, which is where data leaves the dashboard).</para>
/// <para>IMPORT NEVER WRITES TO ANOTHER APP. The old execute pushed straight to Admin Manager with
/// invented values (zone "Default", zone number 1, vehicle "Car"). Now it only fills the step's rows;
/// anything the file didn't have shows as "needs: ..." when the step is sent.</para>
/// </remarks>
[Authorize]
[RequireFeature(FeatureKeys.SetupDashboard)]
[ApiController]
[Route("api/setup/import")]
public class ImportController(
    SmartUploaderService uploader,
    ISessionStore sessions) : ControllerBase
{
    private async Task<SetupSession?> Load(string sessionId, CancellationToken ct)
        => CallerContext.From(User) is { } caller ? await sessions.GetAsync(caller.TenantId, sessionId, ct) : null;

    // Uploads are cached per tenant + session so two tenants can never see each other's file.
    private static string CacheKey(SetupSession s) => $"{s.TenantId}:{s.Id}";

    [HttpPost("detect")]
    public async Task<IActionResult> Detect([FromForm] string sessionId, [FromForm] IFormFile? file, [FromForm] string? entityType, CancellationToken ct)
    {
        if (await Load(sessionId, ct) is not { } session)
        {
            return BadRequest(new { success = false, message = "Invalid session" });
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { success = false, message = "No file provided" });
        }

        var type = entityType ?? GuessEntityType(file.FileName);
        try
        {
            await using var stream = file.OpenReadStream();
            return Ok(await uploader.DetectAndMapAsync(stream, file.FileName, type, CacheKey(session), ct));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Import detect failed for {FileName} ({EntityType})", file.FileName, type);
            return StatusCode(500, new { success = false, message = $"Failed to parse file: {ex.Message}" });
        }
    }

    [HttpPost("preview")]
    public async Task<IActionResult> Preview([FromBody] PreviewRequest req, CancellationToken ct)
    {
        if (await Load(req.SessionId, ct) is not { } session)
        {
            return BadRequest(new { success = false, message = "Invalid session" });
        }

        var result = uploader.GeneratePreview(CacheKey(session), req.Mappings, req.EntityType);
        return result.Success ? Ok(result) : UnprocessableEntity(result);
    }

    /// <summary>Loads the mapped rows into the session's step. Rows are appended; nothing is sent anywhere.</summary>
    [HttpPost("execute")]
    public async Task<IActionResult> Execute([FromBody] ImportRequest req, CancellationToken ct)
    {
        if (await Load(req.SessionId, ct) is not { } session)
        {
            return BadRequest(new { success = false, message = "Invalid session" });
        }

        try
        {
            var rows = uploader.ExecuteMapping(CacheKey(session), req.Mappings);
            var result = new ImportResult { Total = rows.Count };
            string step;

            switch (req.EntityType)
            {
                case "team":
                    step = StepKeys.Team;
                    session.Team.People.AddRange(rows.Select(r =>
                    {
                        var (first, last) = SplitName(V(r, "FirstName"), V(r, "LastName"));
                        return new PersonRow
                        {
                            FirstName = first, LastName = last, Email = V(r, "Email"),
                            JobTitle = V(r, "JobTitle"), Mobile = V(r, "Mobile"), RoleName = V(r, "Role")
                        };
                    }));
                    break;

                case "clients":
                    step = StepKeys.Clients;
                    session.Clients.AddRange(rows.Select(r => new ClientRow
                    {
                        Code = V(r, "Code"), Name = V(r, "Name"), Address = V(r, "Address"), Unit = V(r, "Unit"),
                        Suburb = V(r, "Suburb"), City = V(r, "City"), PostCode = V(r, "PostCode"), Country = V(r, "Country"),
                        Phone = V(r, "Phone"), Email = V(r, "Email"), InvoiceEmail = V(r, "InvoiceEmail"),
                        PrimaryContact = new ClientContactRow
                        {
                            FirstName = V(r, "ContactFirstName"), Surname = V(r, "ContactSurname"),
                            Email = V(r, "ContactEmail"), Mobile = V(r, "ContactMobile")
                        }
                    }));
                    break;

                case "contacts":
                    step = StepKeys.Clients;
                    foreach (var r in rows)
                    {
                        var code = V(r, "ClientCode");
                        var client = session.Clients.FirstOrDefault(c =>
                            string.Equals(c.Code?.Trim(), code?.Trim(), StringComparison.OrdinalIgnoreCase)
                            || string.Equals(c.Name?.Trim(), code?.Trim(), StringComparison.OrdinalIgnoreCase));
                        if (client == null)
                        {
                            result.Failed++;
                            result.Errors.Add($"No customer '{code}' on this step - import customers first.");
                            continue;
                        }
                        client.Contacts.Add(new ClientContactRow
                        {
                            FirstName = V(r, "FirstName"), Surname = V(r, "LastName"), Email = V(r, "Email"),
                            Mobile = V(r, "Phone"), JobTitle = V(r, "JobTitle")
                        });
                        result.Imported++;
                    }
                    break;

                case "drivers":
                case "agents":
                    step = StepKeys.Couriers;
                    // No password: the operator types each one (D2). Rows show "needs: initial app password".
                    session.Couriers.Couriers.AddRange(rows.Select(r => new CourierRow
                    {
                        FirstName = V(r, "FirstName"), SurName = V(r, "SurName"), Email = V(r, "Email"),
                        Code = V(r, "Code"), Mobile = V(r, "Phone"), VehicleType = V(r, "Vehicle"), FleetName = V(r, "Fleet")
                    }));
                    break;

                case "zones":
                    step = StepKeys.Rates;
                    foreach (var r in rows)
                    {
                        var groupName = V(r, "ZoneGroup");
                        var zoneName = V(r, "ZoneName");
                        var zip = V(r, "ZipCode");
                        if (groupName == null || zoneName == null)
                        {
                            result.Failed++;
                            result.Errors.Add($"Row with zip '{zip}' has no zone group or zone name.");
                            continue;
                        }
                        var group = session.Rates.ZoneGroups.FirstOrDefault(g => string.Equals(g.Name, groupName, StringComparison.OrdinalIgnoreCase));
                        if (group == null)
                        {
                            session.Rates.ZoneGroups.Add(group = new ZoneGroupRow { Name = groupName });
                        }

                        var zone = group.Zones.FirstOrDefault(z => string.Equals(z.Name, zoneName, StringComparison.OrdinalIgnoreCase));
                        if (zone == null)
                        {
                            group.Zones.Add(zone = new ZoneRow { Name = zoneName });
                        }

                        if (zip != null && !zone.Zips.Contains(zip))
                        {
                            zone.Zips.Add(zip);
                        }

                        result.Imported++;
                    }
                    break;

                case "rates":
                    step = StepKeys.Rates;
                    session.Rates.ZoneRates.AddRange(rows.Select(r => new ZoneRateRow
                    {
                        Name = V(r, "Name"), FromZone = V(r, "FromZone"), ToZone = V(r, "ToZone"),
                        ChargeRate = D(r, "ChargeRate"), DriverRate = D(r, "DriverRate"),
                        VehicleSizeNames = V(r, "VehicleSize") is { } vs ? [vs] : []
                        // Speed is picked on the form: files name services in their old system's words.
                    }));
                    break;

                default:
                    return BadRequest(new { success = false, message = $"Unknown import type '{req.EntityType}'." });
            }

            if (req.EntityType is not ("contacts" or "zones"))
            {
                result.Imported = rows.Count;
            }

            result.Success = result.Failed == 0 || result.Imported > 0;
            result.MappedData = rows;

            StepCatalog.Recompute(session, step, hasData: true);
            await sessions.UpdateAsync(session, ct);
            uploader.ClearCache(CacheKey(session));

            return result.Success ? Ok(result) : UnprocessableEntity(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Import execution failed");
            return StatusCode(500, new ImportResult { Success = false, Errors = { ex.Message } });
        }
    }

    [HttpGet("template/{entityType}")]
    public IActionResult GetTemplate(string entityType)
    {
        try
        {
            return File(SmartUploaderService.GenerateTemplate(entityType), "text/csv", $"{entityType}-template.csv");
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    private static string? V(Dictionary<string, string?> row, string key)
        => row.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v.Trim() : null;

    private static decimal? D(Dictionary<string, string?> row, string key)
        => decimal.TryParse(V(row, key)?.TrimStart('$'), System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : null;

    /// <summary>A file with one "Name" column maps it to FirstName; split it if there's no separate last name.</summary>
    internal static (string? First, string? Last) SplitName(string? first, string? last)
    {
        if (first == null || last != null)
        {
            return (first, last);
        }

        var i = first.LastIndexOf(' ');
        return i > 0 ? (first[..i].Trim(), first[(i + 1)..].Trim()) : (first, null);
    }

    private static string GuessEntityType(string fileName)
    {
        var lower = fileName.ToLowerInvariant();
        if (lower.Contains("contact"))
        {
            return "contacts";
        }

        if (lower.Contains("client") || lower.Contains("customer") || lower.Contains("account"))
        {
            return "clients";
        }

        if (lower.Contains("driver") || lower.Contains("courier") || lower.Contains("agent"))
        {
            return "drivers";
        }

        if (lower.Contains("zone") || lower.Contains("zip") || lower.Contains("suburb"))
        {
            return "zones";
        }

        if (lower.Contains("rate") || lower.Contains("price"))
        {
            return "rates";
        }

        if (lower.Contains("team") || lower.Contains("staff") || lower.Contains("user"))
        {
            return "team";
        }

        return "clients";
    }
}
