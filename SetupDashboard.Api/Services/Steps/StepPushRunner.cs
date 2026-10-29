using SetupDashboard.Models;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Services.Steps;

/// <summary>
/// Runs one step's push so that nothing is ever written twice:
/// <list type="bullet">
/// <item>one push per session at a time (<see cref="IPushLock"/>);</item>
/// <item>the session is saved before every write, so the ids of rows already created survive a
///   crash, a pod restart or a closed browser part-way through;</item>
/// <item>writes are not cancelled when the browser goes away - a half-sent request is the one
///   outcome nobody can tell apart from success;</item>
/// <item>rows left behind by records that were edited away are dropped afterwards.</item>
/// </list>
/// </summary>
public sealed class StepPushRunner(ISessionStore sessions, IPushLock pushLock, ITenantAppClient apps)
{
    /// <summary>Longer than any push: Settings answers each row in well under its 60 s timeout.</summary>
    private static readonly TimeSpan LockTtl = TimeSpan.FromMinutes(30);

    public static string LockKey(SetupSession session) => $"setup-push:{session.TenantId}:{session.Id}";

    public sealed record Outcome(bool Ran);

    public async Task<Outcome> RunAsync(SetupSession session, CallerContext caller, IStepPusher pusher)
    {
        await using var held = await pushLock.TryAcquireAsync(LockKey(session), LockTtl);
        if (held == null) return new Outcome(false);

        var started = DateTime.UtcNow;
        apps.BeforeWrite = () => sessions.UpdateAsync(session, CancellationToken.None);
        try
        {
            await pusher.PushAsync(session, caller, CancellationToken.None);
            RowLedger.PruneStale(session.Step(pusher.StepKey), started);
            StepCatalog.Recompute(session, pusher.StepKey, hasData: true);
        }
        finally
        {
            apps.BeforeWrite = null;
            await sessions.UpdateAsync(session, CancellationToken.None);
        }
        return new Outcome(true);
    }
}
