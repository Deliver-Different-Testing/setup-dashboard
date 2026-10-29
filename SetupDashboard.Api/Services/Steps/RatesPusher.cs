using System.Text.Json.Nodes;
using SetupDashboard.Models;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Services.Steps;

/// <summary>
/// Rates &amp; zones through Settings Rates &amp; Pricing (<c>/api/v1/tenant/pricing</c>), in creation order:
/// vehicle sizes → zone groups → zone names → zips → fuel surcharges → zone rates → distance rates.
/// </summary>
/// <remarks>
/// <para>Routed Ops has no pricing API on develop yet (its 9 Oct pricing/zones spec is unbuilt), so
/// Settings is the only write path today.</para>
/// <para>CLIENT LISTS ARE ALWAYS SENT. Settings treats a missing <c>clientIds</c> on a rate as "every
/// customer" (IsDefault = true). An empty list means the same, so the step shows "all customers"
/// for it - the operator chose it, the API didn't default it.</para>
/// <para>Percentages are entered as percent and sent as fractions, matching the Settings page.</para>
/// </remarks>
public sealed class RatesPusher(ITenantAppClient apps) : IStepPusher
{
    public const string VehicleKind = "vehicle-size";
    public const string ZoneGroupKind = "zone-group";
    public const string ZoneKind = "zone";
    public const string ZipKind = "zip";
    public const string FuelKind = "fuel-surcharge";
    public const string ZoneRateKind = "zone-rate";
    public const string DistanceRateKind = "distance-rate";

    public string StepKey => StepKeys.Rates;

    public static Needs Validate(ZoneRateRow r)
        => new Needs()
            .Text(r.Name, "name")
            .Text(r.FromZone, "from zone")
            .Text(r.ToZone, "to zone")
            .Value(r.SpeedId, "speed")
            .When(r.VehicleSizeNames.Count == 0, "at least one vehicle size")
            .Value(r.ChargeRate, "customer charge")
            .Value(r.DriverRate, "driver rate");

    public static Needs Validate(DistanceRateRow r)
        => new Needs()
            .Text(r.Name, "name")
            .Value(r.SpeedId, "speed")
            .When(r.VehicleSizeNames.Count == 0, "at least one vehicle size")
            .Value(r.BaseCharge, "base charge")
            .Value(r.BaseChargeDriver, "base charge (driver)")
            .Value(r.PerDistanceUnit, "per distance unit")
            .Value(r.PerDistanceUnitDriver, "per distance unit (driver)")
            .Value(r.DistanceIncluded, "distance included");

    public static Needs Validate(FuelSurchargeRow f)
        => new Needs().Value(f.RatePercent, "fuel %").Value(f.Start, "start date");

    public async Task PushAsync(SetupSession session, CallerContext caller, CancellationToken ct)
    {
        var ledger = new RowLedger(session.Step(StepKey));
        var rates = session.Rates;

        // ── Vehicle sizes ──
        foreach (var v in rates.VehicleSizes)
        {
            var key = v.Name?.Trim() ?? "";
            if (ledger.AlreadyCreated(VehicleKind, key, out _)) continue;
            if (ledger.IsUnknown(VehicleKind, key)) continue;
            var row = ledger.Row(VehicleKind, key.Length > 0 ? key : "(unnamed vehicle size)");
            var needs = new Needs().Text(v.Name, "name");
            if (needs.Any) { RowLedger.NeedsData(row, needs.Items); continue; }

            var res = await apps.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/v1/tenant/pricing/vehicle-sizes", new
            {
                name = key,
                cubicCapacity = v.CubicCapacity,
                palletCapacity = v.PalletCapacity,
                weightCapacity = v.WeightCapacity,
                fuelPercentage = (v.FuelPercent ?? 0m) / 100m,
            }, ct);
            Record(row, res);
        }
        var vehicles = await LookupAsync("/api/v1/tenant/lookups/vehicle-sizes", ct);

        // ── Zone groups → zones → zips ──
        foreach (var g in rates.ZoneGroups)
        {
            var gKey = g.Name?.Trim() ?? "";
            var gRow = ledger.Row(ZoneGroupKind, gKey.Length > 0 ? gKey : "(unnamed zone group)");
            if (gKey.Length == 0) { RowLedger.NeedsData(gRow, ["name"]); continue; }

            if (ledger.IsUnknown(ZoneGroupKind, gKey)) continue;
            int? groupId = ledger.IdOf(ZoneGroupKind, gKey);
            if (groupId == null)
            {
                var res = await apps.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/v1/tenant/pricing/zone-groups", new { name = gKey }, ct);
                if (!Record(gRow, res)) continue;
                groupId = res.Id;
            }

            foreach (var z in g.Zones)
            {
                var zName = z.Name?.Trim() ?? "";
                // Keyed by group as well: two groups can each have a "Downtown".
                var zKey = ZoneKey(gKey, zName);
                var zRow = ledger.Row(ZoneKind, zName.Length > 0 ? zKey : $"(unnamed zone in {gKey})");
                if (zName.Length == 0) { RowLedger.NeedsData(zRow, ["name"]); continue; }

                if (ledger.IsUnknown(ZoneKind, zKey)) continue;
                int? zoneId = ledger.IdOf(ZoneKind, zKey);
                if (zoneId == null)
                {
                    var res = await apps.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/v1/tenant/pricing/zone-names",
                        new { name = zName, zoneGroupId = groupId }, ct);
                    if (!Record(zRow, res)) continue;
                    zoneId = res.Id;
                }

                foreach (var zip in z.Zips.Select(x => x?.Trim()).Where(x => !string.IsNullOrEmpty(x)).Distinct())
                {
                    var zipKey = $"{zKey} / {zip}";
                    if (ledger.AlreadyCreated(ZipKind, zipKey, out _)) continue;
                    if (ledger.IsUnknown(ZipKind, zipKey)) continue;
                    var res = await apps.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/v1/tenant/pricing/zone-zips",
                        new { zip, zoneNameId = zoneId }, ct);
                    Record(ledger.Row(ZipKind, zipKey), res);
                }
            }
        }
        var zones = await LookupAsync("/api/v1/tenant/lookups/zone-names", ct);

        // ── Fuel surcharges ──
        foreach (var f in rates.FuelSurcharges)
        {
            var key = f.Name?.Trim() is { Length: > 0 } n ? n : $"Fuel {f.RatePercent}% from {f.Start:yyyy-MM-dd}";
            if (ledger.AlreadyCreated(FuelKind, key, out _)) continue;
            if (ledger.IsUnknown(FuelKind, key)) continue;
            var row = ledger.Row(FuelKind, key);
            var needs = Validate(f);
            int? clientId = null;
            if (!string.IsNullOrWhiteSpace(f.ClientCode))
            {
                clientId = ClientsPusher.ClientIdFor(session, f.ClientCode);
                needs.When(clientId == null, $"customer {f.ClientCode} created on the Clients step");
            }
            if (needs.Any) { RowLedger.NeedsData(row, needs.Items); continue; }

            var res = await apps.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/v1/tenant/pricing/fuel-surcharges", new
            {
                name = f.Name?.Trim(),
                rate = f.RatePercent!.Value / 100m,
                start = f.Start!.Value,
                clientId,
                active = true,
            }, ct);
            Record(row, res);
        }

        // ── Zone rates ──
        foreach (var r in rates.ZoneRates)
        {
            var key = r.Name?.Trim() ?? "";
            if (ledger.AlreadyCreated(ZoneRateKind, key, out _)) continue;
            if (ledger.IsUnknown(ZoneRateKind, key)) continue;
            var row = ledger.Row(ZoneRateKind, key.Length > 0 ? key : "(unnamed zone rate)");
            var needs = Validate(r);
            var from = ResolveZone(zones, ledger, r.FromZone, needs);
            var to = ResolveZone(zones, ledger, r.ToZone, needs);
            var vehicleIds = ResolveAll(vehicles, ledger, VehicleKind, r.VehicleSizeNames, needs, "vehicle size");
            var clientIds = ResolveClients(session, r.ClientCodes, needs);
            if (needs.Any) { RowLedger.NeedsData(row, needs.Items); continue; }

            var res = await apps.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/v1/tenant/pricing/zone-rates", new
            {
                name = key,
                fromZoneNameId = from,
                toZoneNameId = to,
                speedId = r.SpeedId,
                vehicleIds,
                chargeRate = r.ChargeRate,
                driverRate = r.DriverRate,
                clientIds,
                active = true,
            }, ct);
            Record(row, res, clientIds.Count == 0 ? "Applies to every customer." : null);
        }

        // ── Distance rates ──
        foreach (var r in rates.DistanceRates)
        {
            var key = r.Name?.Trim() ?? "";
            if (ledger.AlreadyCreated(DistanceRateKind, key, out _)) continue;
            if (ledger.IsUnknown(DistanceRateKind, key)) continue;
            var row = ledger.Row(DistanceRateKind, key.Length > 0 ? key : "(unnamed distance rate)");
            var needs = Validate(r);
            var vehicleIds = ResolveAll(vehicles, ledger, VehicleKind, r.VehicleSizeNames, needs, "vehicle size");
            var clientIds = ResolveClients(session, r.ClientCodes, needs);
            if (needs.Any) { RowLedger.NeedsData(row, needs.Items); continue; }

            var res = await apps.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/v1/tenant/pricing/distance-rates", new
            {
                name = key,
                speedId = r.SpeedId,
                vehicleIds,
                baseCharge = r.BaseCharge,
                baseChargeDp = r.BaseChargeDriver,
                perDistanceUnit = r.PerDistanceUnit,
                perDistanceUnitDp = r.PerDistanceUnitDriver,
                distanceIncluded = r.DistanceIncluded,
                depots = r.DepotIds.Distinct().Select(d => new { bulkRegionId = d, active = true }).ToList(),
                clientIds,
                active = true,
            }, ct);
            Record(row, res, clientIds.Count == 0 ? "Applies to every customer." : null);
        }
    }

    private static bool Record(RowResult row, ApiResult res, string? notice = null)
    {
        if (!res.Ok) { RowLedger.Failed(row, res); return false; }
        // Similar-rate warnings come back on a successful save; keep them visible.
        var warn = res.Messages.Count > 0 ? string.Join(" ", res.Messages) : null;
        RowLedger.Created(row, res.Id, string.Join(" ", new[] { notice, warn }.Where(s => !string.IsNullOrWhiteSpace(s))) is { Length: > 0 } n ? n : null);
        return true;
    }

    private async Task<Dictionary<string, int>> LookupAsync(string path, CancellationToken ct)
    {
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var res = await apps.GetAsync(TenantApp.Settings, path, ct);
        if (!res.Ok) return map;
        foreach (var o in (res.Body as JsonArray ?? []).OfType<JsonObject>())
            if (o["name"]?.GetValue<string>() is { Length: > 0 } name && o["id"]?.GetValue<int>() is int id and > 0)
                map.TryAdd(name.Trim(), id);
        return map;
    }

    private static int? Resolve(Dictionary<string, int> lookup, RowLedger ledger, string kind, string? name, Needs needs, string label)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;
        var id = ledger.IdOf(kind, name) ?? (lookup.TryGetValue(name.Trim(), out var l) ? l : null);
        needs.When(id == null, $"{label} \"{name}\" in Settings");
        return id;
    }

    internal static string ZoneKey(string group, string zone) => $"{group} / {zone}";

    /// <summary>
    /// A rate names its zone either as "Zone" or "Group / Zone". A bare name that this session
    /// created in more than one group is ambiguous, so it becomes a need rather than a guess.
    /// </summary>
    private static int? ResolveZone(Dictionary<string, int> lookup, RowLedger ledger, string? name, Needs needs)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;
        var n = name.Trim();
        var id = ledger.IdOf(ZoneKind, n);
        if (id == null)
        {
            var created = ledger.CreatedIds(ZoneKind, key => key.EndsWith(" / " + n, StringComparison.OrdinalIgnoreCase));
            if (created.Count > 1)
            {
                needs.When(true, $"zone \"{n}\" named with its group (\"Group / {n}\") - it is in more than one group");
                return null;
            }
            id = created.Count == 1 ? created[0] : lookup.TryGetValue(n, out var l) ? l : null;
        }
        needs.When(id == null, $"zone \"{n}\" in Settings");
        return id;
    }

    private static List<int> ResolveAll(Dictionary<string, int> lookup, RowLedger ledger, string kind, IEnumerable<string> names, Needs needs, string label)
        => names.Where(n => !string.IsNullOrWhiteSpace(n)).Select(n => Resolve(lookup, ledger, kind, n, needs, label))
            .Where(i => i != null).Select(i => i!.Value).Distinct().ToList();

    private static List<int> ResolveClients(SetupSession session, IEnumerable<string> codes, Needs needs)
    {
        var ids = new List<int>();
        foreach (var code in codes.Where(c => !string.IsNullOrWhiteSpace(c)))
        {
            var id = ClientsPusher.ClientIdFor(session, code);
            needs.When(id == null, $"customer {code} created on the Clients step");
            if (id != null) ids.Add(id.Value);
        }
        return ids.Distinct().ToList();
    }
}
