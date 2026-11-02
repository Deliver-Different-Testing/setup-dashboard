using System.Text.Json.Nodes;
using SetupDashboard.Models;

namespace SetupDashboard.Services.Steps;

/// <summary>
/// Reads what Garry's tenant seed has already done (docs/DONE-ANOTHER-WAY-2026-11-01.md, D5). These are
/// suggestions shown with a one-click confirm; nothing here ticks a checklist item.
/// </summary>
public static class TenantSeed
{
    // New tenant databases are copied from Urgent's; the seed clears its details. Anything still naming
    // Urgent means the seed hasn't run (or missed it).
    private const string SourceTenantMarker = "urgent";

    /// <summary>The seed's System Settings look done: the tenant client file exists and the settings are no longer Urgent's.</summary>
    public static bool LooksDone(TblSetting? setting, bool tenantClientFile)
        => tenantClientFile
           && setting is { CompanyAddress: { } address }
           && !string.IsNullOrWhiteSpace(address)
           && !address.Contains(SourceTenantMarker, StringComparison.OrdinalIgnoreCase)
           && !(setting.AdminEmail ?? string.Empty).Contains(SourceTenantMarker, StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Active roles the tenant owns, from Settings' <c>/api/admin/roles</c>. The Global Default roles every tenant
    /// shares have no tenantClientId and aren't counted. Null when Settings didn't answer.
    /// </summary>
    public static int? OwnRoleCount(JsonNode? roles)
        => roles is not JsonArray list
            ? null
            : list.OfType<JsonObject>().Count(o =>
                o["tenantClientId"] is JsonValue v && v.TryGetValue<int>(out _)
                && (o["isActive"]?.GetValue<bool>() ?? true));
}
