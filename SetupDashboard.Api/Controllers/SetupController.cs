using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SetupDashboard.Core.Domain;
using SetupDashboard.Models;
using SetupDashboard.Services;

namespace SetupDashboard.Controllers;

/// <summary>
/// Session management and core setup endpoints.
/// Maps to the existing React frontend's api.ts calls.
/// </summary>
[Authorize]
[ApiController]
[Route("api/setup")]
public class SetupController : ControllerBase
{
    private readonly ISessionStore _sessions;
    private readonly AdminManagerClientFactory _clientFactory;
    private readonly IDbContextFactory<DynamicDespatchDbContext> _dbFactory;
    private readonly ProvisioningService _provisioning;
    private readonly ILogger<SetupController> _logger;
    private readonly ITenantLogoService _logoService;

    /// <summary>Capture the shared Hub cookie from the current request (must be called before Task.Run).</summary>
    private string? CaptureRequestCookie() => Request.Headers.Cookie.FirstOrDefault();

    public SetupController(
        ISessionStore sessions,
        AdminManagerClientFactory clientFactory,
        IDbContextFactory<DynamicDespatchDbContext> dbFactory,
        ProvisioningService provisioning,
        ILogger<SetupController> logger,
        ITenantLogoService logoService)
    {
        _sessions = sessions;
        _clientFactory = clientFactory;
        _dbFactory = dbFactory;
        _provisioning = provisioning;
        _logger = logger;
        _logoService = logoService;
    }

    // --- Session Management ---

    [AllowAnonymous]
    [HttpPost("session")]
    public IActionResult CreateSession([FromBody] CreateSessionRequest? req)
    {
        var session = _sessions.Create(req?.Environment);
        return Ok(new { session = new { id = session.Id, environment = session.Environment } });
    }

    [AllowAnonymous]
    [HttpGet("sessions")]
    public IActionResult ListSessions([FromQuery] string status = "active")
    {
        var sessions = _sessions.List(status).Select(s => new
        {
            s.Id,
            environment = s.Environment,
            currentStep = s.CurrentStep,
            completedSteps = s.CompletedSteps,
            businessData = s.Business,
            createdAt = s.CreatedAt.ToString("o"),
            updatedAt = s.UpdatedAt.ToString("o"),
        });
        return Ok(new { sessions });
    }

    [AllowAnonymous]
    [HttpGet("session/{id}/full")]
    public IActionResult GetFullSession(string id)
    {
        var session = _sessions.Get(id);
        if (session == null) return NotFound(new { message = "Session not found" });

        return Ok(new
        {
            session = new
            {
                session.Id,
                session.Environment,
                currentStep = session.CurrentStep,
                completedSteps = session.CompletedSteps,
                business = session.Business,
                team = session.Team,
                clients = session.Clients,
                rates = session.Rates,
                couriers = session.Couriers,
                automations = session.Automations,
                training = session.TrainingProgress,
            }
        });
    }

    [AllowAnonymous]
    [HttpDelete("session/{id}/rollback")]
    public IActionResult RollbackSession(string id)
    {
        var deleted = _sessions.Delete(id);
        if (!deleted) return NotFound(new { success = false, message = "Session not found" });
        return Ok(new { success = true });
    }

    // --- Phase 1: Load tenant data from SQL Server ---

    // Fast summary endpoint — counts + settings only (~50ms)
    [HttpGet("session/{id}/tenant-summary")]
    public async Task<IActionResult> GetTenantSummary(string id)
    {
        var session = _sessions.Get(id);
        if (session == null) return NotFound(new { message = "Session not found" });

        try
        {
            await using var db = _dbFactory.CreateDbContext();

            var setting = await db.TblSettings.AsNoTracking().FirstOrDefaultAsync();
            var settingsDict = new Dictionary<string, string>();
            if (setting != null)
            {
                settingsDict["SystemName"] = setting.SystemName ?? "";
                settingsDict["ApplicationName"] = setting.ApplicationName ?? "";
                settingsDict["AdminEmail"] = setting.AdminEmail ?? "";
                settingsDict["CountryCode"] = setting.CountryCode ?? "";
                settingsDict["CompanyAddress"] = setting.CompanyAddress ?? "";
            }

            var counts = new TenantCounts
            {
                Team = await db.TblUsers.AsNoTracking().CountAsync(u => u.Active),
                Clients = await db.TucClients.AsNoTracking().CountAsync(c => c.UcclActive),
                Contacts = await db.TucClientContacts.AsNoTracking().CountAsync(cc => cc.Active),
                Couriers = await db.TucAgents.AsNoTracking().CountAsync(),
                Zones = await db.ZoneNames.AsNoTracking().CountAsync(),
                Automations = await db.AutomationRules.AsNoTracking().CountAsync(a => a.IsActive),
                Services = await db.TblServices.AsNoTracking().CountAsync(),
            };

            return Ok(new TenantSummary { Settings = settingsDict, Counts = counts });
        }
        catch (UnauthorizedAccessException)
        {
            _logger.LogWarning("No tenant context available for tenant summary — returning empty data");
            return Ok(new TenantSummary());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load tenant summary for session {SessionId}", id);
            return StatusCode(500, new { success = false, message = "Failed to load tenant summary" });
        }
    }

    // Legacy endpoint — now returns summary only for backward compatibility
    [HttpGet("session/{id}/tenant-data")]
    public async Task<IActionResult> GetTenantData(string id)
    {
        return await GetTenantSummary(id);
    }

    // --- Step 0: Business Profile ---

    [AllowAnonymous]
    [HttpPost("business")]
    public IActionResult SaveBusiness([FromBody] BusinessSaveRequest req)
    {
        var session = _sessions.GetOrThrow(req.SessionId);
        session.Business = new BusinessProfile
        {
            CompanyName = req.CompanyName,
            Geography = req.Geography ?? new(),
            Verticals = req.Verticals ?? new(),
            CurrentSystem = req.CurrentSystem,
            DeliveriesPerMonth = req.DeliveriesPerMonth,
            LegalName = req.LegalName,
            RegistrationNumber = req.RegistrationNumber,
            CountryOfRegistration = req.CountryOfRegistration,
            StateOfIncorporation = req.StateOfIncorporation,
            BusinessType = req.BusinessType,
            CardNumber = req.CardNumber,
            CardExpiry = req.CardExpiry,
            CardCvc = req.CardCvc,
            CardholderName = req.CardholderName,
            BillingAddress = req.BillingAddress,
            PrimaryContact = req.PrimaryContact,
        };
        session.CurrentStep = Math.Max(session.CurrentStep, 0);
        _sessions.Update(session);
        return Ok(new { success = true });
    }

    // --- Step 1: Team ---

    [AllowAnonymous]
    [HttpPost("team")]
    public async Task<IActionResult> SaveTeam([FromBody] TeamSaveRequest req)
    {
        var session = _sessions.GetOrThrow(req.SessionId);
        session.Team = req.Members ?? new();
        session.CurrentStep = Math.Max(session.CurrentStep, 1);
        _sessions.Update(session);

        // Phase 2: Push to Admin Manager API
        var cookie = CaptureRequestCookie();
        _ = Task.Run(async () =>
        {
            try
            {
                var result = await _provisioning.ProvisionUsersAsync(
                    session.Environment, session.Team,
                    session.ProvisionedIds.GetValueOrDefault("users"), cookie);
                if (result.CreatedIds.Count > 0)
                {
                    if (!session.ProvisionedIds.ContainsKey("users"))
                        session.ProvisionedIds["users"] = new();
                    session.ProvisionedIds["users"].AddRange(result.CreatedIds);
                    _sessions.Update(session);
                }
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Background user provisioning failed"); }
        });

        return Ok(new { success = true });
    }

    // --- Step 2: Clients ---

    [AllowAnonymous]
    [HttpPost("clients")]
    public async Task<IActionResult> SaveClients([FromBody] ClientsSaveRequest req)
    {
        var session = _sessions.GetOrThrow(req.SessionId);
        session.Clients = req.Clients ?? new();
        session.CurrentStep = Math.Max(session.CurrentStep, 2);
        _sessions.Update(session);

        // Phase 2: Push to Admin Manager API
        var cookie = CaptureRequestCookie();
        _ = Task.Run(async () =>
        {
            try
            {
                var result = await _provisioning.ProvisionClientsAsync(
                    session.Environment, session.Clients,
                    session.ProvisionedIds.GetValueOrDefault("clients"), cookie);
                if (result.CreatedIds.Count > 0)
                {
                    if (!session.ProvisionedIds.ContainsKey("clients"))
                        session.ProvisionedIds["clients"] = new();
                    session.ProvisionedIds["clients"].AddRange(result.CreatedIds);
                    _sessions.Update(session);
                }
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Background client provisioning failed"); }
        });

        return Ok(new { success = true });
    }

    [AllowAnonymous]
    [HttpPost("clients/import")]
    public async Task<IActionResult> ImportClientsCsv([FromForm] string sessionId, IFormFile file)
    {
        var session = _sessions.GetOrThrow(sessionId);

        using var reader = new StreamReader(file.OpenReadStream());
        var clients = new List<ClientRecord>();
        var header = await reader.ReadLineAsync();
        while (!reader.EndOfStream)
        {
            var line = await reader.ReadLineAsync();
            if (string.IsNullOrWhiteSpace(line)) continue;
            var parts = line.Split(',').Select(p => p.Trim('"', ' ')).ToArray();
            clients.Add(new ClientRecord
            {
                Name = parts.ElementAtOrDefault(0) ?? "",
                Contact = parts.ElementAtOrDefault(1),
                Phone = parts.ElementAtOrDefault(2),
                Email = parts.ElementAtOrDefault(3),
                Billing = parts.ElementAtOrDefault(4),
            });
        }

        session.Clients.AddRange(clients);
        _sessions.Update(session);
        return Ok(new { success = true, imported = clients.Count });
    }

    // --- Step 3: Rates ---

    [AllowAnonymous]
    [HttpPost("rates")]
    public async Task<IActionResult> SaveRates([FromBody] RatesSaveRequest req)
    {
        var session = _sessions.GetOrThrow(req.SessionId);
        session.Rates = new RateConfig
        {
            BaseRate = req.BaseRate,
            PerKmRate = req.PerKmRate,
            MinCharge = req.MinCharge,
            FuelSurcharge = req.FuelSurcharge,
            WaitTime = req.WaitTime,
            AfterHours = req.AfterHours,
            Zones = req.Zones ?? new(),
            WeightBreaks = req.WeightBreaks ?? new(),
        };
        session.CurrentStep = Math.Max(session.CurrentStep, 3);
        _sessions.Update(session);

        // Phase 2: Push zones and rates to Admin Manager API
        var cookie = CaptureRequestCookie();
        _ = Task.Run(async () =>
        {
            try
            {
                // Zones first (dependency for rates)
                if (session.Rates.Zones.Count > 0)
                {
                    var zoneResult = await _provisioning.ProvisionZonesAsync(
                        session.Environment, session.Rates.Zones,
                        session.ProvisionedIds.GetValueOrDefault("zones"), cookie);
                    if (zoneResult.CreatedIds.Count > 0)
                    {
                        if (!session.ProvisionedIds.ContainsKey("zones"))
                            session.ProvisionedIds["zones"] = new();
                        session.ProvisionedIds["zones"].AddRange(zoneResult.CreatedIds);
                    }
                }

                // Then rates/extra charges
                var rateResult = await _provisioning.ProvisionRatesAsync(
                    session.Environment, session.Rates, session.ProvisionedIds, cookie);
                _sessions.Update(session);
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Background rate provisioning failed"); }
        });

        return Ok(new { success = true });
    }

    // --- Step 4: Couriers ---

    [AllowAnonymous]
    [HttpPost("couriers")]
    public async Task<IActionResult> SaveCouriers([FromBody] CouriersSaveRequest req)
    {
        var session = _sessions.GetOrThrow(req.SessionId);
        session.Couriers = req.Couriers ?? new();
        session.CurrentStep = Math.Max(session.CurrentStep, 4);
        _sessions.Update(session);

        // Phase 2: Push to Admin Manager API
        var cookie = CaptureRequestCookie();
        _ = Task.Run(async () =>
        {
            try
            {
                var result = await _provisioning.ProvisionCouriersAsync(
                    session.Environment, session.Couriers,
                    session.ProvisionedIds.GetValueOrDefault("couriers"), cookie);
                if (result.CreatedIds.Count > 0)
                {
                    if (!session.ProvisionedIds.ContainsKey("couriers"))
                        session.ProvisionedIds["couriers"] = new();
                    session.ProvisionedIds["couriers"].AddRange(result.CreatedIds);
                    _sessions.Update(session);
                }
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Background courier provisioning failed"); }
        });

        return Ok(new { success = true });
    }

    // --- Step 5: Automations ---

    [AllowAnonymous]
    [HttpPost("automations")]
    public async Task<IActionResult> SaveAutomations([FromBody] AutomationsSaveRequest req)
    {
        var session = _sessions.GetOrThrow(req.SessionId);
        session.Automations = req.Rules ?? new();
        session.CurrentStep = Math.Max(session.CurrentStep, 5);
        _sessions.Update(session);

        // Phase 2: Push to Admin Manager API
        var cookie = CaptureRequestCookie();
        _ = Task.Run(async () =>
        {
            try
            {
                var result = await _provisioning.ProvisionAutomationsAsync(
                    session.Environment, session.Automations,
                    session.ProvisionedIds.GetValueOrDefault("automations"), cookie);
                if (result.CreatedIds.Count > 0)
                {
                    if (!session.ProvisionedIds.ContainsKey("automations"))
                        session.ProvisionedIds["automations"] = new();
                    session.ProvisionedIds["automations"].AddRange(result.CreatedIds);
                    _sessions.Update(session);
                }
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Background automation provisioning failed"); }
        });

        return Ok(new { success = true });
    }

    // --- Training ---

    [AllowAnonymous]
    [HttpGet("training/progress")]
    public IActionResult GetTrainingProgress([FromQuery] string sessionId)
    {
        var session = _sessions.GetOrThrow(sessionId);
        return Ok(new { progress = session.TrainingProgress });
    }

    [AllowAnonymous]
    [HttpPost("training/progress")]
    public IActionResult SaveTrainingProgress([FromBody] TrainingProgressRequest req)
    {
        var session = _sessions.GetOrThrow(req.SessionId);
        session.TrainingProgress = req.Members ?? new();
        _sessions.Update(session);
        return Ok(new { success = true });
    }

    [AllowAnonymous]
    [HttpPost("training/complete-challenge")]
    public IActionResult CompleteChallenge([FromBody] CompleteChallengeRequest req)
    {
        var session = _sessions.GetOrThrow(req.SessionId);
        var member = session.TrainingProgress.FirstOrDefault(m => m.UserEmail == req.UserEmail);
        if (member == null)
        {
            return NotFound(new { message = $"Training member with email '{req.UserEmail}' not found. Save training progress first." });
        }

        if (!member.CompletedChallenges.Contains(req.ChallengeId))
        {
            member.CompletedChallenges.Add(req.ChallengeId);
            member.Xp += req.XpEarned;
            member.LastActive = DateTime.UtcNow.ToString("o");
        }
        _sessions.Update(session);
        return Ok(new { success = true, member = new { member.UserEmail, member.Xp, member.CompletedChallenges } });
    }

    [AllowAnonymous]
    [HttpGet("training/leaderboard")]
    public IActionResult GetLeaderboard([FromQuery] string sessionId)
    {
        var session = _sessions.GetOrThrow(sessionId);
        var leaderboard = session.TrainingProgress
            .OrderByDescending(m => m.Xp)
            .Select((m, i) => new { rank = i + 1, m.UserEmail, m.UserName, m.Xp, m.CompletedChallenges, m.CurrentStreak })
            .ToList();
        return Ok(new { leaderboard });
    }

    // --- Phase 3: Real Validation via EF Core ---

    [AllowAnonymous]
    [HttpGet("validate/user-fullname")]
    public async Task<IActionResult> ValidateUserFullName([FromQuery] string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Ok(new { available = true });
        try
        {
            await using var db = _dbFactory.CreateDbContext();
            var exists = await db.TblUsers.AnyAsync(u => u.FullName == name);
            return Ok(new { available = !exists });
        }
        catch (UnauthorizedAccessException)
        {
            return Ok(new { available = true, @unchecked = true });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "User full name validation failed, returning unchecked");
            return Ok(new { available = true, @unchecked = true });
        }
    }

    [AllowAnonymous]
    [HttpGet("validate/username")]
    public async Task<IActionResult> ValidateUsername([FromQuery] string? username)
    {
        if (string.IsNullOrWhiteSpace(username))
            return Ok(new { available = true });
        try
        {
            await using var db = _dbFactory.CreateDbContext();
            var exists = await db.TblUsers.AnyAsync(u => u.UserName == username && u.Active);
            return Ok(new { available = !exists });
        }
        catch (UnauthorizedAccessException)
        {
            return Ok(new { available = true, @unchecked = true });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Username validation failed, returning unchecked");
            return Ok(new { available = true, @unchecked = true });
        }
    }

    [AllowAnonymous]
    [HttpGet("validate/client-name")]
    public async Task<IActionResult> ValidateClientName([FromQuery] string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Ok(new { available = true });
        try
        {
            await using var db = _dbFactory.CreateDbContext();
            var exists = await db.TucClients.AnyAsync(c => c.UcclName == name);
            return Ok(new { available = !exists });
        }
        catch (UnauthorizedAccessException)
        {
            return Ok(new { available = true, @unchecked = true });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Client name validation failed, returning unchecked");
            return Ok(new { available = true, @unchecked = true });
        }
    }

    [AllowAnonymous]
    [HttpGet("validate/client-code")]
    public async Task<IActionResult> ValidateClientCode([FromQuery] string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
            return Ok(new { available = true });
        try
        {
            await using var db = _dbFactory.CreateDbContext();
            var exists = await db.TucClients.AnyAsync(c => c.UcclCode == code && c.UcclActive);
            return Ok(new { available = !exists });
        }
        catch (UnauthorizedAccessException)
        {
            return Ok(new { available = true, @unchecked = true });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Client code validation failed, returning unchecked");
            return Ok(new { available = true, @unchecked = true });
        }
    }

    [AllowAnonymous]
    [HttpGet("validate/courier-name")]
    public async Task<IActionResult> ValidateCourierName([FromQuery] string? firstName, [FromQuery] string? surname)
    {
        if (string.IsNullOrWhiteSpace(firstName) && string.IsNullOrWhiteSpace(surname))
            return Ok(new { available = true });
        try
        {
            await using var db = _dbFactory.CreateDbContext();
            var exists = await db.Database.SqlQueryRaw<int>(
                "SELECT COUNT(1) AS [Value] FROM tucCourier WHERE uccrName = {0} AND uccrSurname = {1}",
                firstName ?? "", surname ?? "").FirstAsync() > 0;
            return Ok(new { available = !exists });
        }
        catch (UnauthorizedAccessException)
        {
            return Ok(new { available = true, @unchecked = true });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Courier name validation failed, returning unchecked");
            return Ok(new { available = true, @unchecked = true });
        }
    }

    [AllowAnonymous]
    [HttpGet("validate/courier-code")]
    public async Task<IActionResult> ValidateCourierCode([FromQuery] string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
            return Ok(new { available = true });
        try
        {
            await using var db = _dbFactory.CreateDbContext();
            var exists = await db.Database.SqlQueryRaw<int>(
                "SELECT COUNT(1) AS [Value] FROM tucCourier WHERE Code = {0} AND Active = 1",
                code).FirstAsync() > 0;
            return Ok(new { available = !exists });
        }
        catch (UnauthorizedAccessException)
        {
            return Ok(new { available = true, @unchecked = true });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Courier code validation failed, returning unchecked");
            return Ok(new { available = true, @unchecked = true });
        }
    }

    // --- Phase 5: Go Live ---

    [HttpPost("session/{id}/go-live")]
    public async Task<IActionResult> GoLive(string id)
    {
        var session = _sessions.Get(id);
        if (session == null) return NotFound(new { message = "Session not found" });

        var report = new Dictionary<string, object>();
        var errors = new List<string>();
        var cookie = CaptureRequestCookie();

        // Provision in dependency order: Zones → Rates → Clients → Couriers → Users → Automations
        try
        {
            // Zones
            if (session.Rates?.Zones?.Count > 0)
            {
                var zoneResult = await _provisioning.ProvisionZonesAsync(
                    session.Environment, session.Rates.Zones,
                    session.ProvisionedIds.GetValueOrDefault("zones"), cookie);
                report["zones"] = zoneResult.Succeeded;
                if (zoneResult.CreatedIds.Count > 0)
                {
                    if (!session.ProvisionedIds.ContainsKey("zones"))
                        session.ProvisionedIds["zones"] = new();
                    session.ProvisionedIds["zones"].AddRange(zoneResult.CreatedIds);
                }
                errors.AddRange(zoneResult.Errors);
            }

            // Rates
            if (session.Rates != null)
            {
                var rateResult = await _provisioning.ProvisionRatesAsync(
                    session.Environment, session.Rates, session.ProvisionedIds, cookie);
                report["rates"] = rateResult.Succeeded;
                errors.AddRange(rateResult.Errors);
            }

            // Clients
            if (session.Clients.Count > 0)
            {
                var clientResult = await _provisioning.ProvisionClientsAsync(
                    session.Environment, session.Clients,
                    session.ProvisionedIds.GetValueOrDefault("clients"), cookie);
                report["clients"] = clientResult.Succeeded;
                if (clientResult.CreatedIds.Count > 0)
                {
                    if (!session.ProvisionedIds.ContainsKey("clients"))
                        session.ProvisionedIds["clients"] = new();
                    session.ProvisionedIds["clients"].AddRange(clientResult.CreatedIds);
                }
                errors.AddRange(clientResult.Errors);
            }

            // Couriers
            if (session.Couriers.Count > 0)
            {
                var courierResult = await _provisioning.ProvisionCouriersAsync(
                    session.Environment, session.Couriers,
                    session.ProvisionedIds.GetValueOrDefault("couriers"), cookie);
                report["couriers"] = courierResult.Succeeded;
                if (courierResult.CreatedIds.Count > 0)
                {
                    if (!session.ProvisionedIds.ContainsKey("couriers"))
                        session.ProvisionedIds["couriers"] = new();
                    session.ProvisionedIds["couriers"].AddRange(courierResult.CreatedIds);
                }
                errors.AddRange(courierResult.Errors);
            }

            // Users
            if (session.Team.Count > 0)
            {
                var userResult = await _provisioning.ProvisionUsersAsync(
                    session.Environment, session.Team,
                    session.ProvisionedIds.GetValueOrDefault("users"), cookie);
                report["users"] = userResult.Succeeded;
                if (userResult.CreatedIds.Count > 0)
                {
                    if (!session.ProvisionedIds.ContainsKey("users"))
                        session.ProvisionedIds["users"] = new();
                    session.ProvisionedIds["users"].AddRange(userResult.CreatedIds);
                }
                errors.AddRange(userResult.Errors);
            }

            // Automations
            if (session.Automations.Count > 0)
            {
                var autoResult = await _provisioning.ProvisionAutomationsAsync(
                    session.Environment, session.Automations,
                    session.ProvisionedIds.GetValueOrDefault("automations"), cookie);
                report["automations"] = autoResult.Succeeded;
                if (autoResult.CreatedIds.Count > 0)
                {
                    if (!session.ProvisionedIds.ContainsKey("automations"))
                        session.ProvisionedIds["automations"] = new();
                    session.ProvisionedIds["automations"].AddRange(autoResult.CreatedIds);
                }
                errors.AddRange(autoResult.Errors);
            }

            session.Status = "completed";
            _sessions.Update(session);

            var goLiveSuccess = errors.Count == 0;
            var result = new { success = goLiveSuccess, provisioned = report, errors };
            return goLiveSuccess ? Ok(result) : UnprocessableEntity(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Go Live failed for session {SessionId}", id);
            return StatusCode(500, new
            {
                success = false,
                provisioned = report,
                errors = new List<string> { ex.Message },
            });
        }
    }

    // --- Tenant Logo (direct S3, same as Hub) ---
    // Bucket: urgent-couriers-bulk-upload-storage-{environment}

    [HttpGet("logo")]
    public async Task<IActionResult> GetLogo([FromQuery] string? environment, [FromQuery] string? tenantCode)
    {
        try
        {
            // Use provided environment, or find from active session
            var env = environment;
            if (string.IsNullOrEmpty(env))
            {
                var sessions = _sessions.List("active");
                env = sessions.FirstOrDefault()?.Environment;
            }

            // Get tenant code from query param, claims, or environment prefix
            var code = tenantCode
                ?? HttpContext.User.Claims.FirstOrDefault(c => c.Type == "TenantCode")?.Value
                ?? "";

            var logoUrl = await _logoService.GetLogoUrlAsync(env ?? "", code);
            return Ok(new { success = logoUrl != null, logoUrl });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not fetch tenant logo");
            return StatusCode(500, new { success = false, logoUrl = (string?)null, message = "Failed to fetch logo" });
        }
    }

    // --- Environments ---

    [AllowAnonymous]
    [HttpGet("environments")]
    public IActionResult GetEnvironments()
    {
        var envs = _clientFactory.GetEnvironmentDetails();
        return Ok(new
        {
            environments = envs.Select(e => new
            {
                key = e.Key,
                name = e.Value.Name,
                baseUrl = e.Value.BaseUrl,
            })
        });
    }
}

// --- Request DTOs ---

public record CreateSessionRequest(string? Environment);

public class BusinessSaveRequest
{
    public string SessionId { get; set; } = "";
    public string? CompanyName { get; set; }
    public List<string>? Geography { get; set; }
    public List<string>? Verticals { get; set; }
    public string? CurrentSystem { get; set; }
    public string? DeliveriesPerMonth { get; set; }
    public string? LegalName { get; set; }
    public string? RegistrationNumber { get; set; }
    public string? CountryOfRegistration { get; set; }
    public string? StateOfIncorporation { get; set; }
    public string? BusinessType { get; set; }
    public string? CardNumber { get; set; }
    public string? CardExpiry { get; set; }
    public string? CardCvc { get; set; }
    public string? CardholderName { get; set; }
    public Address? BillingAddress { get; set; }
    public ContactInfo? PrimaryContact { get; set; }
}

public class TeamSaveRequest
{
    public string SessionId { get; set; } = "";
    public List<TeamMember>? Members { get; set; }
}

public class ClientsSaveRequest
{
    public string SessionId { get; set; } = "";
    public List<ClientRecord>? Clients { get; set; }
}

public class RatesSaveRequest
{
    public string SessionId { get; set; } = "";
    public decimal BaseRate { get; set; }
    public decimal PerKmRate { get; set; }
    public decimal MinCharge { get; set; }
    public decimal FuelSurcharge { get; set; }
    public decimal WaitTime { get; set; }
    public decimal AfterHours { get; set; }
    public List<ZoneRateRow>? Zones { get; set; }
    public List<WeightBreakRow>? WeightBreaks { get; set; }
}

public class CouriersSaveRequest
{
    public string SessionId { get; set; } = "";
    public List<CourierRecord>? Couriers { get; set; }
}

public class AutomationsSaveRequest
{
    public string SessionId { get; set; } = "";
    public List<SetupAutomationRule>? Rules { get; set; }
}

public class TrainingProgressRequest
{
    public string SessionId { get; set; } = "";
    public List<TrainingMember>? Members { get; set; }
}

public class CompleteChallengeRequest
{
    public string SessionId { get; set; } = "";
    public string UserEmail { get; set; } = "";
    public string ChallengeId { get; set; } = "";
    public int XpEarned { get; set; }
}
