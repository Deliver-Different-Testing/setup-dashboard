using System.Text.Json;
using DeliverDifferent.AccessControl.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SetupDashboard.Core.Domain;
using SetupDashboard.Models;
using SetupDashboard.Services;
using SetupDashboard.Services.Steps;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Controllers;

/// <summary>
/// Onboarding sessions and their steps. Every endpoint needs a signed-in Hub user (the fallback
/// policy) and the hub-tile-setup-dashboard switch; every session is the caller's tenant's.
/// </summary>
/// <remarks>
/// The old controller had 22 of 26 endpoints [AllowAnonymous] and wrote to whichever environment the
/// browser named. Nothing here is anonymous, and the tenant only ever comes from the cookie.
/// </remarks>
[Authorize]
[RequireFeature(FeatureKeys.SetupDashboard)]
[ApiController]
[Route("api/setup")]
public class SetupController(
    ISessionStore sessions,
    IEnumerable<IStepPusher> pushers,
    ITenantAppUrls urls,
    IDbContextFactory<DynamicDespatchDbContext> dbFactory,
    ITenantLogoService logoService,
    ILogger<SetupController> logger) : ControllerBase
{
    private CallerContext? Caller => CallerContext.From(User);

    // ── Sessions ────────────────────────────────────────────────────────────

    [HttpPost("session")]
    public async Task<IActionResult> CreateSession(CancellationToken ct)
    {
        if (Caller is not { } caller) return Unauthorized(new { message = "Sign in through Hub first." });
        var session = await sessions.CreateAsync(caller.TenantId, caller.TenantCode, caller.ContactId, caller.Name, ct);
        Seed(session, caller);
        await sessions.UpdateAsync(session, ct);
        return Ok(new { session = View(session) });
    }

    [HttpGet("sessions")]
    public async Task<IActionResult> ListSessions([FromQuery] string? status = "active", CancellationToken ct = default)
    {
        if (Caller is not { } caller) return Unauthorized();
        var list = await sessions.ListAsync(caller.TenantId, status, ct);
        return Ok(new
        {
            sessions = list.Select(s => new
            {
                s.Id,
                s.CurrentStep,
                companyName = s.Business.CompanyName,
                s.CreatedByName,
                s.Status,
                waitingOnTenant = s.Steps.Values.Sum(st => st.Requests.Count(r => r.FulfilledAt == null)),
                stepsDone = s.Steps.Values.Count(st => st.Status == StepStatus.Done),
                createdAt = s.CreatedAt.ToString("o"),
                updatedAt = s.UpdatedAt.ToString("o"),
            }),
        });
    }

    [HttpGet("session/{id}")]
    public async Task<IActionResult> GetSession(string id, CancellationToken ct)
    {
        if (await Load(id, ct) is not { } loaded) return NotFound(new { message = "Session not found" });
        return Ok(new { session = View(loaded.Session) });
    }

    /// <summary>Deleting a session forgets the dashboard's record only; nothing created in Settings is removed.</summary>
    [HttpDelete("session/{id}")]
    public async Task<IActionResult> DeleteSession(string id, CancellationToken ct)
    {
        if (Caller is not { IsDfAdmin: true } caller) return Forbid();
        return await sessions.DeleteAsync(caller.TenantId, id, ct) ? Ok(new { success = true }) : NotFound();
    }

    [HttpPost("session/{id}/current-step")]
    public async Task<IActionResult> SetCurrentStep(string id, [FromBody] CurrentStepRequest req, CancellationToken ct)
    {
        if (await Load(id, ct) is not { } loaded) return NotFound();
        loaded.Session.CurrentStep = Math.Clamp(req.Step, 0, StepKeys.All.Length - 1);
        await sessions.UpdateAsync(loaded.Session, ct);
        return Ok(new { success = true });
    }

    // ── Step data ───────────────────────────────────────────────────────────

    /// <summary>Saves a step's records to the session. Nothing leaves the dashboard until /push.</summary>
    [HttpPut("session/{id}/steps/{step}/data")]
    public async Task<IActionResult> SaveStepData(string id, string step, [FromBody] JsonElement body, CancellationToken ct)
    {
        if (await Load(id, ct) is not { } loaded) return NotFound();
        var s = loaded.Session;
        var opts = DistributedSessionStore.Json;
        try
        {
            switch (step)
            {
                case StepKeys.Business: s.Business = body.Deserialize<BusinessProfile>(opts) ?? new(); break;
                case StepKeys.Team: s.Team = body.Deserialize<TeamStep>(opts) ?? new(); break;
                case StepKeys.Clients: s.Clients = body.Deserialize<List<ClientRow>>(opts) ?? new(); break;
                case StepKeys.Rates: s.Rates = body.Deserialize<RatesStep>(opts) ?? new(); break;
                case StepKeys.Schedules: s.Schedules = body.Deserialize<List<ScheduleRow>>(opts) ?? new(); break;
                case StepKeys.Couriers: s.Couriers = MergeCouriers(s.Couriers, body.Deserialize<CouriersStep>(opts) ?? new()); break;
                case StepKeys.Partners: s.Partners = body.Deserialize<List<PartnerRow>>(opts) ?? new(); break;
                default: return BadRequest(new { message = $"Step '{step}' has no data of its own." });
            }
        }
        catch (JsonException ex)
        {
            return BadRequest(new { message = $"That doesn't look like {step} data: {ex.Message}" });
        }

        StepCatalog.Recompute(s, step, hasData: true);
        await sessions.UpdateAsync(s, ct);
        return Ok(new { session = View(s) });
    }

    /// <summary>
    /// Sends the step's records to the app that owns them, row by row, as the signed-in person.
    /// Synchronous on purpose: the old dashboard answered "success" and pushed in a background task,
    /// so failures were only ever logged.
    /// </summary>
    [HttpPost("session/{id}/steps/{step}/push")]
    public async Task<IActionResult> PushStep(string id, string step, CancellationToken ct)
    {
        if (await Load(id, ct) is not { } loaded) return NotFound();
        var pusher = pushers.FirstOrDefault(p => p.StepKey == step);
        if (pusher == null) return BadRequest(new { message = $"Step '{step}' is a checklist; there is nothing to send." });

        await pusher.PushAsync(loaded.Session, loaded.Caller, ct);
        StepCatalog.Recompute(loaded.Session, step, hasData: true);
        await sessions.UpdateAsync(loaded.Session, ct);

        var rows = loaded.Session.Step(step).Rows;
        return Ok(new
        {
            session = View(loaded.Session),
            summary = new
            {
                created = rows.Count(r => r.Status == RowStatus.Created),
                needsData = rows.Count(r => r.Status == RowStatus.NeedsData),
                failed = rows.Count(r => r.Status == RowStatus.Failed),
                signInExpired = rows.Any(r => r.Errors.Any(e => e.StartsWith("Your sign-in has expired"))),
            },
        });
    }

    // ── Progress: requests to the tenant, checklist, completion ─────────────

    [HttpPost("session/{id}/steps/{step}/requests")]
    public async Task<IActionResult> AddRequest(string id, string step, [FromBody] DataRequestCreate req, CancellationToken ct)
    {
        if (await Load(id, ct) is not { } loaded) return NotFound();
        if (!loaded.Caller.IsDfAdmin) return Forbid();
        if (string.IsNullOrWhiteSpace(req.Item)) return BadRequest(new { message = "Say what you're asking the tenant for." });

        var st = loaded.Session.Step(step);
        st.Requests.Add(new DataRequest { Item = req.Item.Trim(), DueBy = req.DueBy, RequestedBy = loaded.Caller.Name });
        StepCatalog.Recompute(loaded.Session, step, hasData: false);
        await sessions.UpdateAsync(loaded.Session, ct);
        return Ok(new { session = View(loaded.Session) });
    }

    [HttpPost("session/{id}/steps/{step}/requests/{requestId}/fulfil")]
    public async Task<IActionResult> FulfilRequest(string id, string step, string requestId, CancellationToken ct)
    {
        if (await Load(id, ct) is not { } loaded) return NotFound();
        var r = loaded.Session.Step(step).Requests.FirstOrDefault(x => x.Id == requestId);
        if (r == null) return NotFound();
        r.FulfilledAt ??= DateTime.UtcNow;
        r.FulfilledBy ??= loaded.Caller.Name;
        StepCatalog.Recompute(loaded.Session, step, hasData: false);
        await sessions.UpdateAsync(loaded.Session, ct);
        return Ok(new { session = View(loaded.Session) });
    }

    /// <summary>DFRNT-owned items are ticked by DF Admin; tenant-owned items by anyone on the session.</summary>
    [HttpPost("session/{id}/steps/{step}/checklist/{itemId}")]
    public async Task<IActionResult> TickChecklist(string id, string step, string itemId, [FromBody] ChecklistTick req, CancellationToken ct)
    {
        if (await Load(id, ct) is not { } loaded) return NotFound();
        var item = loaded.Session.Step(step).Checklist.FirstOrDefault(c => c.Id == itemId);
        if (item == null) return NotFound();
        if (item.Owner == "DFRNT" && !loaded.Caller.IsDfAdmin)
            return StatusCode(403, new { message = "DFRNT ticks this one." });

        item.DoneAt = req.Done ? DateTime.UtcNow : null;
        item.DoneBy = req.Done ? loaded.Caller.Name : null;
        StepCatalog.Recompute(loaded.Session, step, hasData: false);
        await sessions.UpdateAsync(loaded.Session, ct);
        return Ok(new { session = View(loaded.Session) });
    }

    [HttpPost("session/{id}/steps/{step}/complete")]
    public async Task<IActionResult> CompleteStep(string id, string step, CancellationToken ct)
    {
        if (await Load(id, ct) is not { } loaded) return NotFound();
        if (StepCatalog.CompleteBlocker(loaded.Session, step) is { } why) return Conflict(new { message = why });

        var st = loaded.Session.Step(step);
        st.Status = StepStatus.Done;
        st.CompletedAt = DateTime.UtcNow;
        st.CompletedBy = loaded.Caller.Name;
        if (loaded.Session.Steps.Values.All(x => x.Status == StepStatus.Done)) loaded.Session.Status = "completed";
        await sessions.UpdateAsync(loaded.Session, ct);
        return Ok(new { session = View(loaded.Session) });
    }

    [HttpPost("session/{id}/steps/{step}/reopen")]
    public async Task<IActionResult> ReopenStep(string id, string step, CancellationToken ct)
    {
        if (await Load(id, ct) is not { } loaded) return NotFound();
        if (!loaded.Caller.IsDfAdmin) return Forbid();
        var st = loaded.Session.Step(step);
        st.Status = StepStatus.InProgress;
        st.CompletedAt = null;
        st.CompletedBy = null;
        loaded.Session.Status = "active";
        StepCatalog.Recompute(loaded.Session, step, hasData: false);
        await sessions.UpdateAsync(loaded.Session, ct);
        return Ok(new { session = View(loaded.Session) });
    }

    // ── Tenant summary (read-only, tenant DB) ───────────────────────────────

    [HttpGet("session/{id}/tenant-summary")]
    public async Task<IActionResult> GetTenantSummary(string id, CancellationToken ct)
    {
        if (await Load(id, ct) is null) return NotFound(new { message = "Session not found" });
        try
        {
            await using var db = dbFactory.CreateDbContext();
            var setting = await db.TblSettings.AsNoTracking().FirstOrDefaultAsync(ct);
            var settings = new Dictionary<string, string>();
            if (setting != null)
            {
                settings["SystemName"] = setting.SystemName ?? "";
                settings["ApplicationName"] = setting.ApplicationName ?? "";
                settings["AdminEmail"] = setting.AdminEmail ?? "";
                settings["CountryCode"] = setting.CountryCode ?? "";
                settings["CompanyAddress"] = setting.CompanyAddress ?? "";
            }

            return Ok(new TenantSummary
            {
                Settings = settings,
                Counts = new TenantCounts
                {
                    // Staff are contacts on the tenant's own client now, not tblUser rows.
                    Team = await db.TucClientContacts.AsNoTracking().CountAsync(cc => cc.Active && cc.UcctClient != null && cc.UcctClient.ClientTypeId == CallerContext.TenantClientType, ct),
                    Clients = await db.TucClients.AsNoTracking().CountAsync(c => c.UcclActive && c.ClientTypeId == 2, ct),
                    Contacts = await db.TucClientContacts.AsNoTracking().CountAsync(cc => cc.Active, ct),
                    Couriers = await db.Database.SqlQueryRaw<int>("SELECT COUNT(1) AS [Value] FROM tucCourier WHERE Active = 1").FirstAsync(ct),
                    Zones = await db.ZoneNames.AsNoTracking().CountAsync(ct),
                    Automations = await db.AutomationRules.AsNoTracking().CountAsync(a => a.IsActive, ct),
                    Services = await db.TblServices.AsNoTracking().CountAsync(ct),
                },
            });
        }
        catch (UnauthorizedAccessException)
        {
            return Ok(new TenantSummary());
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to load tenant summary for session {SessionId}", id);
            return StatusCode(500, new { message = "Failed to load tenant summary" });
        }
    }

    [HttpGet("logo")]
    public async Task<IActionResult> GetLogo()
    {
        var url = await logoService.GetLogoUrlAsync(Caller?.TenantCode);
        return Ok(new { success = url != null, logoUrl = url });
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private sealed record Loaded(SetupSession Session, CallerContext Caller);

    private async Task<Loaded?> Load(string id, CancellationToken ct)
    {
        if (Caller is not { } caller) return null;
        var session = await sessions.GetAsync(caller.TenantId, id, ct);
        if (session == null) return null;
        Seed(session, caller);
        return new Loaded(session, caller);
    }

    private void Seed(SetupSession session, CallerContext caller)
        => StepCatalog.Seed(session, host => urls.BaseUrlForHost(host, caller));

    /// <summary>The session as the browser sees it: courier passwords never leave the server.</summary>
    internal static object View(SetupSession s) => new
    {
        s.Id,
        s.TenantCode,
        s.CurrentStep,
        s.Status,
        s.CreatedByName,
        createdAt = s.CreatedAt.ToString("o"),
        updatedAt = s.UpdatedAt.ToString("o"),
        steps = s.Steps,
        business = s.Business,
        team = s.Team,
        clients = s.Clients,
        rates = s.Rates,
        schedules = s.Schedules,
        couriers = new
        {
            fleets = s.Couriers.Fleets,
            couriers = s.Couriers.Couriers.Select(c => new
            {
                c.Email, c.FirstName, c.SurName, c.Code, c.Mobile, c.VehicleType, c.CourierTypeId, c.FleetName,
                hasInitialPassword = !string.IsNullOrEmpty(c.InitialPassword),
            }),
        },
        partners = s.Partners,
        training = s.TrainingProgress,
    };

    /// <summary>The browser never has the passwords back, so a blank one means "keep what's stored".</summary>
    internal static CouriersStep MergeCouriers(CouriersStep stored, CouriersStep incoming)
    {
        foreach (var c in incoming.Couriers.Where(c => string.IsNullOrEmpty(c.InitialPassword)))
        {
            var prior = stored.Couriers.FirstOrDefault(p =>
                string.Equals(p.Email?.Trim(), c.Email?.Trim(), StringComparison.OrdinalIgnoreCase));
            c.InitialPassword = prior?.InitialPassword;
        }
        return incoming;
    }
}

public sealed record CurrentStepRequest(int Step);
public sealed record DataRequestCreate(string Item, DateTime? DueBy);
public sealed record ChecklistTick(bool Done);
