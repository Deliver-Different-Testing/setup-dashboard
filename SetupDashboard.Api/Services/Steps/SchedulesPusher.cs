using SetupDashboard.Models;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Services.Steps;

/// <summary>
/// Schedules through Routed Ops Schedules (NEW): <c>POST /api/v2/schedules</c>.
/// </summary>
/// <remarks>
/// Rules are Routed Ops' own (ScheduleService.UpsertAsync / ValidateUpsert, develop 25921f4): a name, a
/// destination depot, at least one day window with start and end. A client-origin schedule can't be the
/// default and needs an origin depot plus at least one client (7 Oct decision). Routed Ops doesn't stop
/// duplicate names, so this step's own ledger is what keeps a re-run from making a second copy.
/// </remarks>
public sealed class SchedulesPusher(ITenantAppClient apps) : IStepPusher
{
    private const string ScheduleKind = "schedule";
    private static readonly string[] OriginTypes = ["depot", "client", "direct"];

    public string StepKey => StepKeys.Schedules;

    public static Needs Validate(ScheduleRow s)
    {
        var origin = (s.OriginType ?? string.Empty).Trim().ToLowerInvariant();
        var needs = new Needs()
            .Text(s.Name, "name")
            .Value(s.RegionId, "destination depot")
            .Text(s.OriginType, "origin (depot, client address or direct)")
            .When(origin.Length > 0 && !OriginTypes.Contains(origin), "origin of depot, client or direct")
            .When(s.DayWindows.Count == 0, "at least one day window");

        foreach (var (w, i) in s.DayWindows.Select((w, i) => (w, i + 1)))
            needs.When(w.DayOfWeek is null or < 1 or > 7, $"day for window {i}")
                 .When(!IsTime(w.StartTime), $"start time (HH:mm) for window {i}")
                 .When(!IsTime(w.EndTime), $"end time (HH:mm) for window {i}")
                 .When(w.CutoffTime != null && !IsTime(w.CutoffTime), $"cutoff time (HH:mm) for window {i}");

        var days = s.DayWindows.Where(w => w.DayOfWeek != null).GroupBy(w => w.DayOfWeek).Where(g => g.Count() > 1).ToList();
        needs.When(days.Count > 0, "one window per day");

        switch (origin)
        {
            case "client":
                needs.Value(s.OriginRegionId, "origin depot (client-address schedules)")
                    .When(s.ClientCodes.Count == 0, "at least one customer (client-address schedules can't be the default)");
                break;
            case "depot":
                needs.Value(s.PickupDepotId, "pickup depot");
                break;
        }

        return needs;
    }

    public async Task PushAsync(SetupSession session, CallerContext caller, CancellationToken ct)
    {
        var ledger = new RowLedger(session.Step(StepKey));
        foreach (var s in session.Schedules)
        {
            var key = s.Name?.Trim() ?? string.Empty;
            if (ledger.AlreadyCreated(ScheduleKind, key, out _))
            {
                continue;
            }

            if (ledger.IsUnknown(ScheduleKind, key))
            {
                continue;
            }

            var row = ledger.Row(ScheduleKind, key.Length > 0 ? key : "(unnamed schedule)");

            var needs = Validate(s);
            var clientIds = new List<int>();
            foreach (var code in s.ClientCodes.Where(c => !string.IsNullOrWhiteSpace(c)))
            {
                var id = ClientsPusher.ClientIdFor(session, code);
                needs.When(id == null, $"customer {code} created on the Clients step");
                if (id != null)
                {
                    clientIds.Add(id.Value);
                }
            }
            if (needs.Any) { RowLedger.NeedsData(row, needs.Items); continue; }

            var origin = s.OriginType!.Trim().ToLowerInvariant();
            var res = await apps.SendAsync(TenantApp.RoutedOps, HttpMethod.Post, "/api/v2/schedules", new
            {
                name = key,
                regionId = s.RegionId,
                pickupDepotId = origin == "depot" ? s.PickupDepotId : null,
                originType = origin,
                originRegionId = origin == "client" ? s.OriginRegionId : null,
                speedId = s.SpeedId,
                isDefault = clientIds.Count == 0,
                // clientCodes null => clientIds is the set (Routed Ops NewScheduleModal does the same).
                clientCodes = (string[]?)null,
                clientIds = clientIds.Distinct().ToList(),
                isActive = true,
                dayWindows = s.DayWindows.Select(w => new
                {
                    dayOfWeek = w.DayOfWeek,
                    startTime = w.StartTime!.Trim(),
                    endTime = w.EndTime!.Trim(),
                    cutoffDay = w.CutoffDay,
                    cutoffTime = string.IsNullOrWhiteSpace(w.CutoffTime) ? null : w.CutoffTime.Trim()
                }).ToList()
            }, ct);

            if (!res.Ok || res.Id == null) { RowLedger.Failed(row, res); continue; }
            RowLedger.Created(row, res.Id, clientIds.Count == 0 ? "Default schedule: applies to every customer." : null);
        }
    }

    private static bool IsTime(string? t) => !string.IsNullOrWhiteSpace(t) && TimeSpan.TryParse(t.Trim(), out var ts) && ts >= TimeSpan.Zero && ts < TimeSpan.FromDays(1);
}
