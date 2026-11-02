using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Serilog;
using SetupDashboard.Models;

namespace SetupDashboard.Services;

/// <summary>
/// Tenant-scoped onboarding sessions. Every call names the tenant (from the
/// caller's CurrentTenantID claim); a session belonging to another tenant is
/// indistinguishable from one that doesn't exist.
/// </summary>
public interface ISessionStore
{
    Task<SetupSession> CreateAsync(int tenantId, string? tenantCode, int? contactId, string? createdByName, CancellationToken ct = default);
    Task<SetupSession?> GetAsync(int tenantId, string id, CancellationToken ct = default);
    Task<List<SetupSession>> ListAsync(int tenantId, string? status = null, CancellationToken ct = default);
    Task UpdateAsync(SetupSession session, CancellationToken ct = default);
    Task<bool> DeleteAsync(int tenantId, string id, CancellationToken ct = default);
}

/// <summary>
/// One implementation over IDistributedCache: Redis in deployed environments,
/// the in-memory distributed cache in development.
/// </summary>
/// <remarks>
/// SLIDING 120 DAYS, NOT 24 HOURS. The old store expired a session a day after
/// creation, which suits a demo and not an onboarding that waits on the tenant
/// for weeks. Each write slides the expiry.
/// </remarks>
public class DistributedSessionStore(IDistributedCache cache) : ISessionStore
{
    private static readonly DistributedCacheEntryOptions Lifetime = new() { SlidingExpiration = TimeSpan.FromDays(120) };

    internal static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private static string SessionKey(int tenantId, string id) => $"setup-session:{tenantId}:{id}";
    private static string IndexKey(int tenantId) => $"setup-sessions:{tenantId}";

    public async Task<SetupSession> CreateAsync(int tenantId, string? tenantCode, int? contactId, string? createdByName, CancellationToken ct = default)
    {
        if (tenantId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(tenantId), "A session needs the caller's tenant.");
        }

        var session = new SetupSession
        {
            TenantId = tenantId,
            TenantCode = tenantCode,
            CreatedByContactId = contactId,
            CreatedByName = createdByName
        };
        await SaveAsync(session, ct);
        await AddToIndexAsync(tenantId, session.Id, ct);
        return session;
    }

    public async Task<SetupSession?> GetAsync(int tenantId, string id, CancellationToken ct = default)
    {
        if (tenantId <= 0 || string.IsNullOrWhiteSpace(id))
        {
            return null;
        }

        var json = await cache.GetStringAsync(SessionKey(tenantId, id), ct);
        if (string.IsNullOrEmpty(json))
        {
            return null;
        }

        var session = JsonSerializer.Deserialize<SetupSession>(json, Json);
        // Belt and braces: the key already carries the tenant.
        return session?.TenantId == tenantId ? session : null;
    }

    public async Task<List<SetupSession>> ListAsync(int tenantId, string? status = null, CancellationToken ct = default)
    {
        var result = new List<SetupSession>();
        foreach (var id in await ReadIndexAsync(tenantId, ct))
        {
            var s = await GetAsync(tenantId, id, ct);
            if (s != null && (status == null || s.Status == status))
            {
                result.Add(s);
            }
        }
        return [.. result.OrderByDescending(s => s.UpdatedAt)];
    }

    public async Task UpdateAsync(SetupSession session, CancellationToken ct = default)
    {
        session.UpdatedAt = DateTime.UtcNow;
        await SaveAsync(session, ct);
    }

    public async Task<bool> DeleteAsync(int tenantId, string id, CancellationToken ct = default)
    {
        if (await GetAsync(tenantId, id, ct) == null)
        {
            return false;
        }

        await cache.RemoveAsync(SessionKey(tenantId, id), ct);
        var ids = await ReadIndexAsync(tenantId, ct);
        ids.Remove(id);
        await cache.SetStringAsync(IndexKey(tenantId), JsonSerializer.Serialize(ids), Lifetime, ct);
        return true;
    }

    private Task SaveAsync(SetupSession session, CancellationToken ct)
        => cache.SetStringAsync(SessionKey(session.TenantId, session.Id), JsonSerializer.Serialize(session, Json), Lifetime, ct);

    private async Task AddToIndexAsync(int tenantId, string id, CancellationToken ct)
    {
        var ids = await ReadIndexAsync(tenantId, ct);
        if (!ids.Contains(id))
        {
            ids.Add(id);
        }

        await cache.SetStringAsync(IndexKey(tenantId), JsonSerializer.Serialize(ids), Lifetime, ct);
    }

    private async Task<List<string>> ReadIndexAsync(int tenantId, CancellationToken ct)
    {
        try
        {
            var json = await cache.GetStringAsync(IndexKey(tenantId), ct);
            return string.IsNullOrEmpty(json) ? [] : JsonSerializer.Deserialize<List<string>>(json) ?? [];
        }
        catch (JsonException ex)
        {
            Log.Warning(ex, "Session index for tenant {TenantId} was unreadable; starting a new one", tenantId);
            return [];
        }
    }
}
