using System.Collections.Concurrent;
using StackExchange.Redis;

namespace SetupDashboard.Services;

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

/// <summary>Across pods, through Redis. The TTL frees a lock whose pod died mid-push.</summary>
public sealed class RedisPushLock(IConnectionMultiplexer redis) : IPushLock
{
    public async Task<IAsyncDisposable?> TryAcquireAsync(string key, TimeSpan ttl)
    {
        var token = Guid.NewGuid().ToString("N");
        var db = redis.GetDatabase();
        return await db.LockTakeAsync(key, token, ttl) ? new Release(db, key, token) : null;
    }

    public async Task<bool> IsHeldAsync(string key) => (await redis.GetDatabase().LockQueryAsync(key)).HasValue;

    private sealed class Release(IDatabase db, RedisKey key, RedisValue token) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync() => await db.LockReleaseAsync(key, token);
    }
}

/// <summary>One process only: development, or when Redis isn't configured.</summary>
public sealed class InMemoryPushLock : IPushLock
{
    private readonly ConcurrentDictionary<string, DateTime> _held = new();

    public Task<IAsyncDisposable?> TryAcquireAsync(string key, TimeSpan ttl)
    {
        var now = DateTime.UtcNow;
        var until = now + ttl;
        var won = _held.TryAdd(key, until)
                  || (_held.TryGetValue(key, out var expires) && expires < now && _held.TryUpdate(key, until, expires));
        return Task.FromResult<IAsyncDisposable?>(won ? new Release(_held, key, until) : null);
    }

    public Task<bool> IsHeldAsync(string key)
        => Task.FromResult(_held.TryGetValue(key, out var expires) && expires >= DateTime.UtcNow);

    private sealed class Release(ConcurrentDictionary<string, DateTime> held, string key, DateTime until) : IAsyncDisposable
    {
        public ValueTask DisposeAsync()
        {
            held.TryRemove(new KeyValuePair<string, DateTime>(key, until));
            return ValueTask.CompletedTask;
        }
    }
}
