using System.Text.Json.Nodes;
using SetupDashboard.Models;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Services.Steps;

public interface IStepPusher
{
    string StepKey { get; }
    Task PushAsync(SetupSession session, CallerContext caller, CancellationToken ct);
}

/// <summary>
/// Team = roles + tile access + people, written the way Settings does it (the Cheetah
/// tenant-admin setup of 24 Oct 2026, skill dfrnt-tenant-setup):
/// <list type="number">
/// <item>Role: <c>POST /api/admin/roles</c>, tagged Tenant Staff (ClientTypeId 4). New roles start with every tile denied.</item>
/// <item>Tiles: <c>PUT /api/v1/tenant/tile-access/roles/{id}/{hub-tile-*}</c> - Access Control, not the role modal.</item>
/// <item>Person: <c>POST /api/admin/contacts</c> on the tenant's own client with the role. Settings creates the
///   Master Controller login and emails an invite. No staff file (tucStaff) or legacy tblUser is created.</item>
/// </list>
/// </summary>
public sealed class TeamPusher(ITenantAppClient apps) : IStepPusher
{
    public const string RoleKind = "role";
    public const string TileKind = "tile";
    public const string PersonKind = "person";

    public string StepKey => StepKeys.Team;

    public static Needs Validate(RoleRow r) => new Needs().Text(r.Name, "role name");

    public static Needs Validate(PersonRow p, IReadOnlyCollection<string> roleNames)
        => new Needs()
            .Text(p.Email, "email")
            .Text(p.FirstName, "first name")
            .Text(p.RoleName, "role")
            .When(!string.IsNullOrWhiteSpace(p.RoleName) && !roleNames.Contains(p.RoleName.Trim(), StringComparer.OrdinalIgnoreCase),
                $"a role called \"{p.RoleName}\" on this step")
            .When(!p.InviteConfirmed, "tick 'send sign-in invite' (creating the person emails them)");

    public async Task PushAsync(SetupSession session, CallerContext caller, CancellationToken ct)
    {
        var step = session.Step(StepKey);
        var ledger = new RowLedger(step);
        var team = session.Team;

        var tenantClient = await FindTenantClientAsync(session, caller, ct);

        // ── Roles + tiles ──
        var existingRoles = await ExistingRolesAsync(ct);
        foreach (var role in team.Roles)
        {
            var key = role.Name?.Trim() ?? "";
            var row = ledger.Row(RoleKind, key.Length > 0 ? key : "(unnamed role)");
            var needs = Validate(role);
            if (needs.Any) { RowLedger.NeedsData(row, needs.Items); continue; }

            int? roleId = ledger.IdOf(RoleKind, key);
            if (roleId == null && existingRoles.TryGetValue(key, out var existingId))
            {
                roleId = existingId;
                RowLedger.Created(row, roleId, "Role already existed in Settings; tiles below were switched on, none were switched off.");
            }
            if (roleId == null)
            {
                var res = await apps.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/admin/roles", new
                {
                    name = key,
                    description = string.IsNullOrWhiteSpace(role.Description) ? null : role.Description.Trim(),
                    // DF Admin can make the role the tenant's own so their staff can edit it later.
                    tenantClientId = caller.IsDfAdmin ? tenantClient.Id : null,
                    clientTypeIds = new[] { CallerContext.TenantClientType },
                }, ct);
                if (!res.Ok || res.Id == null) { RowLedger.Failed(row, res); continue; }
                roleId = res.Id;
                RowLedger.Created(row, roleId);
            }

            foreach (var tile in role.Tiles.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim()).Distinct())
            {
                var tileRow = ledger.Row(TileKind, $"{key} / {tile}");
                if (tileRow.Status == RowStatus.Created) continue;
                if (!tile.StartsWith("hub-tile-", StringComparison.Ordinal))
                {
                    RowLedger.Failed(tileRow, $"\"{tile}\" is not a hub tile.");
                    continue;
                }
                var res = await apps.SendAsync(TenantApp.Settings, HttpMethod.Put,
                    $"/api/v1/tenant/tile-access/roles/{roleId}/{Uri.EscapeDataString(tile)}", new { enabled = true }, ct);
                if (res.Ok) RowLedger.Created(tileRow, roleId);
                else RowLedger.Failed(tileRow, res);
            }
        }

        // ── People ──
        var roleNames = team.Roles.Where(r => !string.IsNullOrWhiteSpace(r.Name)).Select(r => r.Name!.Trim()).ToList();
        var inviteBlocker = StepCatalog.InviteBlocker(session);
        foreach (var person in team.People)
        {
            var key = person.Email?.Trim() ?? "";
            if (ledger.AlreadyCreated(PersonKind, key, out _)) continue;
            var row = ledger.Row(PersonKind, key.Length > 0 ? key : "(no email)");

            var needs = Validate(person, roleNames);
            if (tenantClient.Error != null) needs.When(true, tenantClient.Error);
            if (inviteBlocker != null) needs.When(true, inviteBlocker);
            if (needs.Any) { RowLedger.NeedsData(row, needs.Items); continue; }

            var roleId = ledger.IdOf(RoleKind, person.RoleName!.Trim());
            if (roleId == null)
            {
                RowLedger.NeedsData(row, [$"role \"{person.RoleName}\" created first"]);
                continue;
            }

            var res = await apps.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/admin/contacts", new
            {
                clientId = tenantClient.Id,
                email = key,
                firstName = person.FirstName!.Trim(),
                lastName = person.LastName?.Trim() ?? "",
                jobTitle = person.JobTitle?.Trim() ?? "",
                mobile = person.Mobile?.Trim() ?? "",
                roleIds = new[] { roleId.Value },
            }, ct);

            if (!res.Ok) { RowLedger.Failed(row, res); continue; }
            var notice = res.Body?["inviteNotice"]?.GetValue<string>();
            RowLedger.Created(row, res.Id, notice);
        }
    }

    private sealed record TenantClientRef(int? Id, string? Error);

    /// <summary>
    /// The tenant's own client (ClientTypeId 4) that staff contacts hang off. There is no API to
    /// create it (gap G2), so its absence is a "needs" on every person, not something invented.
    /// </summary>
    private async Task<TenantClientRef> FindTenantClientAsync(SetupSession session, CallerContext caller, CancellationToken ct)
    {
        var res = await apps.GetAsync(TenantApp.Settings, "/api/admin/contacts/lookups/clients?lane=tenant&limit=50", ct);
        if (!res.Ok) return new(null, $"the tenant's client file (Settings: {string.Join(" ", res.Messages)})");

        var list = (res.Body as JsonArray ?? [])
            .OfType<JsonObject>()
            .Select(o => (Id: o["id"]?.GetValue<int>() ?? 0, Name: o["name"]?.GetValue<string>() ?? "", Type: o["clientTypeId"]?.GetValue<int>() ?? 0))
            .Where(c => c.Id > 0 && c.Type == CallerContext.TenantClientType)
            .ToList();

        if (list.Count == 0)
            return new(null, "the tenant's own client file (client type Tenant) - DFRNT creates it (Business step checklist)");
        if (list.Count == 1) return new(list[0].Id, null);

        if (caller.ClientId is { } own && list.Any(c => c.Id == own)) return new(own, null);
        var byName = list.Where(c => string.Equals(c.Name, session.Business.CompanyName?.Trim(), StringComparison.OrdinalIgnoreCase)).ToList();
        if (byName.Count == 1) return new(byName[0].Id, null);

        return new(null, $"one tenant client file - this tenant has {list.Count} ({string.Join(", ", list.Select(c => c.Name))}); set the company name on the Business step to the right one");
    }

    private async Task<Dictionary<string, int>> ExistingRolesAsync(CancellationToken ct)
    {
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var res = await apps.GetAsync(TenantApp.Settings, $"/api/admin/roles?clientType={CallerContext.TenantClientType}", ct);
        if (!res.Ok) return map;
        foreach (var o in (res.Body as JsonArray ?? []).OfType<JsonObject>())
        {
            var name = o["name"]?.GetValue<string>();
            var id = o["contactRoleId"]?.GetValue<int>();
            var active = o["isActive"]?.GetValue<bool>() ?? true;
            if (!string.IsNullOrWhiteSpace(name) && id > 0 && active) map.TryAdd(name.Trim(), id.Value);
        }
        return map;
    }
}
