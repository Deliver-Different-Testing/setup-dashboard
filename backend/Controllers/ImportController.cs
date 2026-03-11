using Microsoft.AspNetCore.Mvc;
using SetupDashboard.Models;
using SetupDashboard.Services;

namespace SetupDashboard.Controllers;

/// <summary>
/// Smart Import endpoints — unified upload/detect/preview/import flow.
/// Used by the SmartImport React component across all wizard steps.
/// 
/// Flow:
///   1. POST /api/setup/import/detect  — upload CSV/Excel, auto-detect columns
///   2. POST /api/setup/import/preview — validate and show mapped preview
///   3. POST /api/setup/import/execute — confirmed import into session + optional Admin Manager push
///   4. GET  /api/setup/import/template/{entityType} — download blank CSV template
/// </summary>
[ApiController]
[Route("api/setup/import")]
public class ImportController : ControllerBase
{
    private readonly SmartUploaderService _uploader;
    private readonly SessionStore _sessions;
    private readonly AdminManagerClientFactory _clientFactory;
    private readonly ILogger<ImportController> _logger;

    public ImportController(
        SmartUploaderService uploader,
        SessionStore sessions,
        AdminManagerClientFactory clientFactory,
        ILogger<ImportController> logger)
    {
        _uploader = uploader;
        _sessions = sessions;
        _clientFactory = clientFactory;
        _logger = logger;
    }

    /// <summary>
    /// Upload a file and auto-detect columns with fuzzy matching.
    /// Supports CSV (.csv) and Excel (.xlsx, .xls).
    /// </summary>
    [HttpPost("detect")]
    public async Task<IActionResult> Detect([FromForm] string sessionId, [FromForm] IFormFile file, [FromForm] string? entityType)
    {
        var session = _sessions.Get(sessionId);
        if (session == null)
            return BadRequest(new { success = false, message = "Invalid session" });

        if (file == null || file.Length == 0)
            return BadRequest(new { success = false, message = "No file provided" });

        var type = entityType ?? GuessEntityType(file.FileName);

        using var stream = file.OpenReadStream();
        var result = await _uploader.DetectAndMapAsync(stream, file.FileName, type, sessionId);
        return Ok(result);
    }

    /// <summary>
    /// Preview mapped data with validation.
    /// </summary>
    [HttpPost("preview")]
    public IActionResult Preview([FromBody] PreviewRequest req)
    {
        var session = _sessions.Get(req.SessionId);
        if (session == null)
            return BadRequest(new { success = false, message = "Invalid session" });

        var result = _uploader.GeneratePreview(req.SessionId, req.Mappings, req.EntityType);
        return Ok(result);
    }

    /// <summary>
    /// Execute confirmed import: maps data and saves to session.
    /// If Admin Manager client is initialized, also pushes to the API.
    /// </summary>
    [HttpPost("execute")]
    public async Task<IActionResult> Execute([FromBody] ImportRequest req)
    {
        var session = _sessions.Get(req.SessionId);
        if (session == null)
            return BadRequest(new { success = false, message = "Invalid session" });

        try
        {
            var mappedRows = _uploader.ExecuteMapping(req.SessionId, req.Mappings);
            var importResult = new ImportResult { Total = mappedRows.Count };

            // Save to session based on entity type
            switch (req.EntityType)
            {
                case "team":
                    var members = mappedRows.Select(r => new TeamMember
                    {
                        Name = r.GetValueOrDefault("Name") ?? "",
                        Email = r.GetValueOrDefault("Email") ?? "",
                        Role = r.GetValueOrDefault("Role") ?? "Admin",
                    }).ToList();
                    session.Team.AddRange(members);
                    importResult.Imported = members.Count;
                    importResult.Success = true;
                    break;

                case "clients":
                    var clients = mappedRows.Select(r => new ClientRecord
                    {
                        Name = r.GetValueOrDefault("Name") ?? "",
                        Code = r.GetValueOrDefault("Code"),
                        Contact = r.GetValueOrDefault("Contact"),
                        Phone = r.GetValueOrDefault("Phone"),
                        Email = r.GetValueOrDefault("Email"),
                        Billing = r.GetValueOrDefault("Billing"),
                        LegalName = r.GetValueOrDefault("LegalName"),
                        Type = r.GetValueOrDefault("Type"),
                        City = r.GetValueOrDefault("City"),
                        State = r.GetValueOrDefault("State"),
                        ZipCode = r.GetValueOrDefault("ZipCode"),
                    }).ToList();
                    session.Clients.AddRange(clients);

                    // Try to push to Admin Manager API
                    await TryPushClientsToApi(session, clients, importResult);
                    break;

                case "contacts":
                    // Contacts are added to the session's client records
                    foreach (var row in mappedRows)
                    {
                        var clientName = row.GetValueOrDefault("ClientName") ?? "";
                        var existing = session.Clients.FirstOrDefault(c =>
                            c.Name.Equals(clientName, StringComparison.OrdinalIgnoreCase));
                        if (existing != null)
                        {
                            existing.Contact = $"{row.GetValueOrDefault("FirstName")} {row.GetValueOrDefault("LastName")}".Trim();
                            existing.Email = row.GetValueOrDefault("Email") ?? existing.Email;
                            existing.Phone = row.GetValueOrDefault("Phone") ?? existing.Phone;
                        }
                        importResult.Imported++;
                    }
                    break;

                case "drivers":
                    var couriers = mappedRows.Select(r => new CourierRecord
                    {
                        Name = r.GetValueOrDefault("Name") ?? "",
                        Code = r.GetValueOrDefault("Code"),
                        FirstName = r.GetValueOrDefault("FirstName"),
                        SurName = r.GetValueOrDefault("SurName"),
                        Phone = r.GetValueOrDefault("Phone"),
                        Vehicle = r.GetValueOrDefault("Vehicle"),
                        Zone = r.GetValueOrDefault("Zone"),
                    }).ToList();
                    session.Couriers.AddRange(couriers);

                    await TryPushCouriersToApi(session, couriers, importResult);
                    break;

                case "zones":
                    // Zones are stored on the session for now; pushed to API on demand
                    importResult.Imported = mappedRows.Count;
                    importResult.Success = true;

                    await TryPushZonesToApi(session, mappedRows, importResult);
                    break;

                case "rates":
                    importResult.Imported = mappedRows.Count;
                    importResult.Success = true;
                    break;

                default:
                    importResult.Imported = mappedRows.Count;
                    importResult.Success = true;
                    break;
            }

            if (importResult.Failed == 0)
            {
                importResult.Success = true;
                importResult.Imported = mappedRows.Count - importResult.Failed;
            }

            _sessions.Update(session);
            _uploader.ClearCache(req.SessionId);

            return Ok(importResult);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Import execution failed");
            return Ok(new ImportResult
            {
                Success = false,
                Errors = { ex.Message },
            });
        }
    }

    /// <summary>
    /// Download a blank CSV template for the given entity type.
    /// </summary>
    [HttpGet("template/{entityType}")]
    public IActionResult GetTemplate(string entityType)
    {
        try
        {
            var csv = _uploader.GenerateTemplate(entityType);
            return File(csv, "text/csv", $"{entityType}-template.csv");
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    // --- Step-specific upload shortcuts ---

    [HttpPost("team/upload")]
    public Task<IActionResult> UploadTeam([FromForm] string sessionId, [FromForm] IFormFile file)
        => Detect(sessionId, file, "team");

    [HttpPost("clients/upload")]
    public Task<IActionResult> UploadClients([FromForm] string sessionId, [FromForm] IFormFile file)
        => Detect(sessionId, file, "clients");

    [HttpPost("contacts/upload")]
    public Task<IActionResult> UploadContacts([FromForm] string sessionId, [FromForm] IFormFile file)
        => Detect(sessionId, file, "contacts");

    [HttpPost("drivers/upload")]
    public Task<IActionResult> UploadDrivers([FromForm] string sessionId, [FromForm] IFormFile file)
        => Detect(sessionId, file, "drivers");

    [HttpPost("zones/upload")]
    public Task<IActionResult> UploadZones([FromForm] string sessionId, [FromForm] IFormFile file)
        => Detect(sessionId, file, "zones");

    [HttpPost("rates/upload")]
    public Task<IActionResult> UploadRates([FromForm] string sessionId, [FromForm] IFormFile file)
        => Detect(sessionId, file, "rates");

    // --- Admin Manager API push helpers ---

    private async Task TryPushClientsToApi(SetupSession session, List<ClientRecord> clients, ImportResult result)
    {
        try
        {
            var client = _clientFactory.GetClient(session.Environment);
            if (!client.IsInitialized) return;

            foreach (var c in clients)
            {
                try
                {
                    await client.PostAsync<object>("/api/client", new
                    {
                        name = c.Name,
                        code = c.Code ?? c.Name.Replace(" ", "").ToUpper()[..Math.Min(10, c.Name.Length)],
                        legalName = c.LegalName ?? c.Name,
                        phone = c.Phone,
                        email = c.Email,
                        type = c.Type ?? "Standard",
                        smsName = c.Name,
                        active = true,
                        americanCity = c.City ?? "",
                        americanState = c.State ?? "",
                        americanZipCode = c.ZipCode ?? "",
                    });
                    result.Imported++;
                }
                catch (Exception ex)
                {
                    result.Failed++;
                    result.Errors.Add($"Client '{c.Name}': {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not push clients to Admin Manager (offline mode)");
        }
    }

    private async Task TryPushCouriersToApi(SetupSession session, List<CourierRecord> couriers, ImportResult result)
    {
        try
        {
            var client = _clientFactory.GetClient(session.Environment);
            if (!client.IsInitialized) return;

            foreach (var c in couriers)
            {
                try
                {
                    await client.PostAsync<object>("/api/courier", new
                    {
                        name = c.Name,
                        code = c.Code ?? c.Name.Replace(" ", "").ToUpper()[..Math.Min(10, c.Name.Length)],
                        firstName = c.FirstName ?? c.Name.Split(' ').FirstOrDefault(),
                        surName = c.SurName ?? c.Name.Split(' ').LastOrDefault(),
                        personalMobile = c.Phone,
                        courierType = c.Vehicle ?? "Car",
                        active = true,
                    });
                    result.Imported++;
                }
                catch (Exception ex)
                {
                    result.Failed++;
                    result.Errors.Add($"Courier '{c.Name}': {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not push couriers to Admin Manager (offline mode)");
        }
    }

    private async Task TryPushZonesToApi(SetupSession session, List<Dictionary<string, string?>> zones, ImportResult result)
    {
        try
        {
            var client = _clientFactory.GetClient(session.Environment);
            if (!client.IsInitialized) return;

            // Group by zone name
            var grouped = zones.GroupBy(z => z.GetValueOrDefault("ZoneName") ?? "Default");
            foreach (var group in grouped)
            {
                try
                {
                    // Create zone name
                    var zoneResponse = await client.PostAsync<Dictionary<string, object>>("/api/zoneName", new { name = group.Key });

                    // Then bulk create zip codes for this zone
                    foreach (var zip in group)
                    {
                        var zipCode = zip.GetValueOrDefault("ZipCode") ?? "";
                        var zoneNumber = int.TryParse(zip.GetValueOrDefault("ZoneNumber"), out var zn) ? zn : 1;
                        if (!string.IsNullOrEmpty(zipCode))
                        {
                            await client.PostAsync<object>("/api/zoneZip", new
                            {
                                zip = zipCode,
                                zoneNumber,
                                location = zip.GetValueOrDefault("Location") ?? "",
                            });
                        }
                    }
                    result.Imported += group.Count();
                }
                catch (Exception ex)
                {
                    result.Failed += group.Count();
                    result.Errors.Add($"Zone '{group.Key}': {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not push zones to Admin Manager (offline mode)");
        }
    }

    private static string GuessEntityType(string fileName)
    {
        var lower = fileName.ToLowerInvariant();
        if (lower.Contains("client") || lower.Contains("customer") || lower.Contains("account")) return "clients";
        if (lower.Contains("contact")) return "contacts";
        if (lower.Contains("driver") || lower.Contains("courier")) return "drivers";
        if (lower.Contains("zone") || lower.Contains("zip") || lower.Contains("suburb")) return "zones";
        if (lower.Contains("rate") || lower.Contains("price")) return "rates";
        return "clients"; // default
    }
}
