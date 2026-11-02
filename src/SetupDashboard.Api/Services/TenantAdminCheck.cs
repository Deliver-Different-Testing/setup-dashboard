using System.Text.Json.Nodes;
using Microsoft.Extensions.Caching.Memory;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Services;

/// <summary>
/// A tenant admin is tenant staff whose role has the "Edit Settings" role action. The dashboard has no
/// admin flag of its own, so Settings is asked which permissions the signed-in person has.
/// </summary>
public interface ITenantAdminCheck
{
    Task<bool> IsTenantAdminAsync(CallerContext caller, CancellationToken ct);
}

public sealed class TenantAdminCheck(ITenantAppClient apps, IMemoryCache cache) : ITenantAdminCheck
{
    /// <summary>Settings' key for the "Edit Settings" role action (dbo.Permission).</summary>
    public const string EditSettings = "edit-settings";

    private static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(10);

    public async Task<bool> IsTenantAdminAsync(CallerContext caller, CancellationToken ct)
    {
        if (caller.ClientTypeId != CallerContext.TenantClientType || caller.ContactId is not { } contactId)
        {
            return false;
        }

        var key = $"tenant-admin:{caller.TenantId}:{contactId}";
        if (cache.TryGetValue(key, out bool known))
        {
            return known;
        }

        var res = await apps.GetAsync(TenantApp.Settings, "/api/me/permissions", ct);
        if (!res.Ok)
        {
            // Not cached: a Settings blip shouldn't lock an admin out for ten minutes.
            return false;
        }

        var isAdmin = (res.Body as JsonArray ?? [])
            .Any(n => n is JsonValue v && v.TryGetValue<string>(out var s) && s == EditSettings);
        cache.Set(key, isAdmin, CacheFor);
        return isAdmin;
    }
}
