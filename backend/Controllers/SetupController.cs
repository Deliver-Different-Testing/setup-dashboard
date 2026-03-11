using Microsoft.AspNetCore.Mvc;
using SetupDashboard.Models;
using SetupDashboard.Services;

namespace SetupDashboard.Controllers;

/// <summary>
/// Session management and core setup endpoints.
/// Maps to the existing React frontend's api.ts calls.
/// </summary>
[ApiController]
[Route("api/setup")]
public class SetupController : ControllerBase
{
    private readonly SessionStore _sessions;
    private readonly AdminManagerClientFactory _clientFactory;

    public SetupController(SessionStore sessions, AdminManagerClientFactory clientFactory)
    {
        _sessions = sessions;
        _clientFactory = clientFactory;
    }

    // --- Session Management ---

    [HttpPost("session")]
    public IActionResult CreateSession([FromBody] CreateSessionRequest? req)
    {
        var session = _sessions.Create(req?.Environment);
        return Ok(new { session = new { id = session.Id, environment = session.Environment } });
    }

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

    [HttpDelete("session/{id}/rollback")]
    public IActionResult RollbackSession(string id)
    {
        var deleted = _sessions.Delete(id);
        return Ok(new { success = deleted });
    }

    // --- Step 0: Business Profile ---

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

    [HttpPost("team")]
    public IActionResult SaveTeam([FromBody] TeamSaveRequest req)
    {
        var session = _sessions.GetOrThrow(req.SessionId);
        session.Team = req.Members ?? new();
        session.CurrentStep = Math.Max(session.CurrentStep, 1);
        _sessions.Update(session);
        return Ok(new { success = true });
    }

    // --- Step 2: Clients ---

    [HttpPost("clients")]
    public IActionResult SaveClients([FromBody] ClientsSaveRequest req)
    {
        var session = _sessions.GetOrThrow(req.SessionId);
        session.Clients = req.Clients ?? new();
        session.CurrentStep = Math.Max(session.CurrentStep, 2);
        _sessions.Update(session);
        return Ok(new { success = true });
    }

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

    [HttpPost("rates")]
    public IActionResult SaveRates([FromBody] RatesSaveRequest req)
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
        return Ok(new { success = true });
    }

    // --- Step 4: Couriers ---

    [HttpPost("couriers")]
    public IActionResult SaveCouriers([FromBody] CouriersSaveRequest req)
    {
        var session = _sessions.GetOrThrow(req.SessionId);
        session.Couriers = req.Couriers ?? new();
        session.CurrentStep = Math.Max(session.CurrentStep, 4);
        _sessions.Update(session);
        return Ok(new { success = true });
    }

    // --- Step 5: Automations ---

    [HttpPost("automations")]
    public IActionResult SaveAutomations([FromBody] AutomationsSaveRequest req)
    {
        var session = _sessions.GetOrThrow(req.SessionId);
        session.Automations = req.Rules ?? new();
        session.CurrentStep = Math.Max(session.CurrentStep, 5);
        _sessions.Update(session);
        return Ok(new { success = true });
    }

    // --- Training ---

    [HttpGet("training/progress")]
    public IActionResult GetTrainingProgress([FromQuery] string sessionId)
    {
        var session = _sessions.GetOrThrow(sessionId);
        return Ok(new { progress = session.TrainingProgress });
    }

    [HttpPost("training/progress")]
    public IActionResult SaveTrainingProgress([FromBody] TrainingProgressRequest req)
    {
        var session = _sessions.GetOrThrow(req.SessionId);
        session.TrainingProgress = req.Members ?? new();
        _sessions.Update(session);
        return Ok(new { success = true });
    }

    [HttpPost("training/complete-challenge")]
    public IActionResult CompleteChallenge([FromBody] CompleteChallengeRequest req)
    {
        var session = _sessions.GetOrThrow(req.SessionId);
        var member = session.TrainingProgress.FirstOrDefault(m => m.UserEmail == req.UserEmail);
        if (member != null)
        {
            if (!member.CompletedChallenges.Contains(req.ChallengeId))
            {
                member.CompletedChallenges.Add(req.ChallengeId);
                member.Xp += req.XpEarned;
                member.LastActive = DateTime.UtcNow.ToString("o");
            }
        }
        _sessions.Update(session);
        return Ok(new { success = true });
    }

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

    // --- Validation ---

    [HttpGet("validate/username")]
    public IActionResult ValidateUsername([FromQuery] string username)
    {
        // In production, would check against Admin Manager API
        // For now, return unchecked (frontend handles gracefully)
        return Ok(new { available = true, @unchecked = true });
    }

    [HttpGet("validate/client-code")]
    public IActionResult ValidateClientCode([FromQuery] string code)
    {
        return Ok(new { available = true, @unchecked = true });
    }

    [HttpGet("validate/courier-code")]
    public IActionResult ValidateCourierCode([FromQuery] string code)
    {
        return Ok(new { available = true, @unchecked = true });
    }

    // --- Environments ---

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
    public List<AutomationRule>? Rules { get; set; }
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
