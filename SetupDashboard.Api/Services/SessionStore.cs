using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using SetupDashboard.Models;

namespace SetupDashboard.Services;

public interface ISessionStore
{
    SetupSession Create(string? environment = null);
    SetupSession? Get(string id);
    SetupSession GetOrThrow(string id);
    List<SetupSession> List(string? status = null);
    void Update(SetupSession session);
    bool Delete(string id);
}

/// <summary>
/// In-memory session store. Used as dev fallback when Redis is unavailable.
/// </summary>
public class InMemorySessionStore : ISessionStore
{
    private readonly ConcurrentDictionary<string, SetupSession> _sessions = new();

    public SetupSession Create(string? environment = null)
    {
        var session = new SetupSession();
        if (!string.IsNullOrEmpty(environment))
            session.Environment = environment;
        _sessions[session.Id] = session;
        return session;
    }

    public SetupSession? Get(string id) => _sessions.TryGetValue(id, out var s) ? s : null;

    public SetupSession GetOrThrow(string id)
        => Get(id) ?? throw new KeyNotFoundException($"Session '{id}' not found");

    public List<SetupSession> List(string? status = null)
        => _sessions.Values
            .Where(s => status == null || s.Status == status)
            .OrderByDescending(s => s.UpdatedAt)
            .ToList();

    public void Update(SetupSession session)
    {
        session.UpdatedAt = DateTime.UtcNow;
        _sessions[session.Id] = session;
    }

    public bool Delete(string id) => _sessions.TryRemove(id, out _);
}

/// <summary>
/// Redis-backed session store. Sessions survive server restarts with 24h expiry.
/// </summary>
public class RedisSessionStore : ISessionStore
{
    private readonly IDistributedCache _cache;
    private readonly ILogger<RedisSessionStore> _logger;
    private const string KeyPrefix = "setup-session:";
    private const string ActiveSetKey = "setup-sessions:active";
    private static readonly DistributedCacheEntryOptions CacheOptions = new()
    {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24)
    };
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public RedisSessionStore(IDistributedCache cache, ILogger<RedisSessionStore> logger)
    {
        _cache = cache;
        _logger = logger;
    }

    public SetupSession Create(string? environment = null)
    {
        var session = new SetupSession();
        if (!string.IsNullOrEmpty(environment))
            session.Environment = environment;
        SaveToCache(session);
        return session;
    }

    public SetupSession? Get(string id)
    {
        try
        {
            var json = _cache.GetString($"{KeyPrefix}{id}");
            if (string.IsNullOrEmpty(json)) return null;
            return JsonSerializer.Deserialize<SetupSession>(json, JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get session {Id} from Redis", id);
            return null;
        }
    }

    public SetupSession GetOrThrow(string id)
        => Get(id) ?? throw new KeyNotFoundException($"Session '{id}' not found");

    public List<SetupSession> List(string? status = null)
    {
        try
        {
            var indexJson = _cache.GetString(ActiveSetKey);
            if (string.IsNullOrEmpty(indexJson)) return new();

            var ids = JsonSerializer.Deserialize<List<string>>(indexJson) ?? new();
            var sessions = new List<SetupSession>();
            foreach (var id in ids)
            {
                var session = Get(id);
                if (session != null && (status == null || session.Status == status))
                    sessions.Add(session);
            }
            return sessions.OrderByDescending(s => s.UpdatedAt).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to list sessions from Redis");
            return new();
        }
    }

    public void Update(SetupSession session)
    {
        session.UpdatedAt = DateTime.UtcNow;
        SaveToCache(session);
    }

    public bool Delete(string id)
    {
        try
        {
            _cache.Remove($"{KeyPrefix}{id}");
            RemoveFromIndex(id);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete session {Id} from Redis", id);
            return false;
        }
    }

    private void SaveToCache(SetupSession session)
    {
        var json = JsonSerializer.Serialize(session, JsonOptions);
        _cache.SetString($"{KeyPrefix}{session.Id}", json, CacheOptions);
        AddToIndex(session.Id);
    }

    private void AddToIndex(string id)
    {
        try
        {
            var indexJson = _cache.GetString(ActiveSetKey);
            var ids = string.IsNullOrEmpty(indexJson)
                ? new List<string>()
                : JsonSerializer.Deserialize<List<string>>(indexJson) ?? new();
            if (!ids.Contains(id))
            {
                ids.Add(id);
                _cache.SetString(ActiveSetKey, JsonSerializer.Serialize(ids), CacheOptions);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to add session {Id} to index", id);
        }
    }

    private void RemoveFromIndex(string id)
    {
        try
        {
            var indexJson = _cache.GetString(ActiveSetKey);
            if (string.IsNullOrEmpty(indexJson)) return;
            var ids = JsonSerializer.Deserialize<List<string>>(indexJson) ?? new();
            ids.Remove(id);
            _cache.SetString(ActiveSetKey, JsonSerializer.Serialize(ids), CacheOptions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to remove session {Id} from index", id);
        }
    }
}

/// <summary>
/// Backwards-compatible alias — existing code references SessionStore directly.
/// </summary>
public class SessionStore : InMemorySessionStore { }
