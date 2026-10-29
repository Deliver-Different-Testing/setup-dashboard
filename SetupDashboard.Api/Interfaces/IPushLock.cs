namespace SetupDashboard.Interfaces;

/// <summary>
/// One push per onboarding session at a time. A push reads the session, writes to Settings row by
/// row and saves as it goes; a second push (a double click, or DF Admin and the tenant together)
/// would send the same rows again and overwrite the first one's record of what it created.
/// </summary>
public interface IPushLock
{
    /// <summary>The lock, or null when someone else holds it. Dispose to release.</summary>
    Task<IAsyncDisposable?> TryAcquireAsync(string key, TimeSpan ttl);

    Task<bool> IsHeldAsync(string key);
}