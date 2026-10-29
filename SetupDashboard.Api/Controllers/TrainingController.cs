using DeliverDifferent.AccessControl.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SetupDashboard.Models;
using SetupDashboard.Services;

namespace SetupDashboard.Controllers;

/// <summary>Training step progress (behaviour unchanged; now signed-in and tenant-scoped).</summary>
[Authorize][RequireFeature(FeatureKeys.SetupDashboard)]

[ApiController]
[Route("api/setup/session/{id}/training")]
public class TrainingController(ISessionStore sessions) : ControllerBase
{
    private async Task<SetupSession?> Load(string id, CancellationToken ct)
        => CallerContext.From(User) is { } caller ? await sessions.GetAsync(caller.TenantId, id, ct) : null;

    [HttpGet]
    public async Task<IActionResult> Get(string id, CancellationToken ct)
        => await Load(id, ct) is { } s ? Ok(new { progress = s.TrainingProgress }) : NotFound();

    [HttpPut]
    public async Task<IActionResult> Save(string id, [FromBody] List<TrainingMember>? members, CancellationToken ct)
    {
        if (await Load(id, ct) is not { } s)
        {
            return NotFound();
        }

        s.TrainingProgress = members ?? new();
        await sessions.UpdateAsync(s, ct);
        return Ok(new { success = true });
    }

    [HttpPost("complete-challenge")]
    public async Task<IActionResult> CompleteChallenge(string id, [FromBody] CompleteChallengeRequest req, CancellationToken ct)
    {
        if (await Load(id, ct) is not { } s)
        {
            return NotFound();
        }

        var member = s.TrainingProgress.FirstOrDefault(m => m.UserEmail == req.UserEmail);
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
        await sessions.UpdateAsync(s, ct);
        return Ok(new { success = true, member = new { member.UserEmail, member.Xp, member.CompletedChallenges } });
    }

    [HttpGet("leaderboard")]
    public async Task<IActionResult> Leaderboard(string id, CancellationToken ct)
    {
        if (await Load(id, ct) is not { } s)
        {
            return NotFound();
        }

        return Ok(new
        {
            leaderboard = s.TrainingProgress
                .OrderByDescending(m => m.Xp)
                .Select((m, i) => new { rank = i + 1, m.UserEmail, m.UserName, m.Xp, m.CompletedChallenges, m.CurrentStreak })
                .ToList()
        });
    }
}

public sealed record CompleteChallengeRequest(string UserEmail, string ChallengeId, int XpEarned);
