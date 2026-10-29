using DeliverDifferent.AccessControl.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Controllers;

/// <summary>
/// Dropdown data for the step forms, read from the owning app as the signed-in person.
/// The browser can't call Settings directly (no CORS), so these are forwarded - read-only,
/// and only the paths listed here.
/// </summary>
[Authorize]
[RequireFeature(FeatureKeys.SetupDashboard)]
[ApiController]
[Route("api/setup/lookups")]
public class LookupsController(ITenantAppClient apps) : ControllerBase
{
    private static readonly Dictionary<string, (TenantApp App, string Path)> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        // Clients step
        ["invoice-schedules"] = (TenantApp.Settings, "/api/v1/tenant/clients/lookups/invoice-schedules"),
        ["payment-terms"] = (TenantApp.Settings, "/api/v1/tenant/clients/lookups/payment-terms"),
        ["address-config"] = (TenantApp.Settings, "/api/v1/tenant/clients/lookups/address-autocomplete-config"),
        // Team / partners
        ["tiles"] = (TenantApp.Settings, "/api/v1/tenant/tile-access"),
        ["tenant-roles"] = (TenantApp.Settings, "/api/admin/contacts/lookups/roles?clientType=4"),
        ["partner-roles"] = (TenantApp.Settings, "/api/admin/contacts/lookups/roles?clientType=3"),
        ["tenant-clients"] = (TenantApp.Settings, "/api/admin/contacts/lookups/clients?lane=tenant&limit=50"),
        // Rates / couriers
        ["depots"] = (TenantApp.Settings, "/api/v1/np/regions"),
        ["speeds"] = (TenantApp.Settings, "/api/v1/tenant/lookups/speeds"),
        ["vehicle-sizes"] = (TenantApp.Settings, "/api/v1/tenant/lookups/vehicle-sizes"),
        ["zone-names"] = (TenantApp.Settings, "/api/v1/tenant/lookups/zone-names"),
        ["zone-groups"] = (TenantApp.Settings, "/api/v1/tenant/lookups/zone-groups"),
        // Schedules
        ["schedule-lookups"] = (TenantApp.RoutedOps, "/api/schedules/lookups")
    };

    [HttpGet("{name}")]
    public async Task<IActionResult> Get(string name, CancellationToken ct)
    {
        if (!Allowed.TryGetValue(name, out var target))
        {
            return NotFound(new { message = $"No lookup called '{name}'." });
        }

        var res = await apps.GetAsync(target.App, target.Path, ct);
        if (res.SignInExpired)
        {
            return StatusCode(401, new { message = res.Messages.FirstOrDefault() });
        }

        if (!res.Ok)
        {
            return StatusCode(res.Status is >= 400 and < 600 ? res.Status : 502, new { message = string.Join(" ", res.Messages) });
        }

        // tile-access returns both grids; the Team step only needs the tile list.
        return Ok(name.Equals("tiles", StringComparison.OrdinalIgnoreCase) ? res.Body?["tiles"] : res.Body);
    }
}
