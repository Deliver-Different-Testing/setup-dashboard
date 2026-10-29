using SetupDashboard.Models;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Services.Steps;

/// <summary>
/// Vehicle fleets (<c>POST /api/v1/np/fleets</c>) and couriers (<c>POST /api/v1/np/fleet</c>, Settings Driver
/// List "Quick Add"). Courier create makes the Master Controller courier login; it doesn't email anyone.
/// </summary>
/// <remarks>
/// Settings requires first name, surname, email and an initial password (the pair first+surname and the
/// email must be unique). The password is typed by the operator (D2), sent once, then cleared from the
/// session. Courier create can't set the fleet and the update endpoint is a full overwrite, so fleet
/// assignment is left as a Driver List checklist item rather than risk deactivating a courier.
/// </remarks>
public sealed class CouriersPusher(ITenantAppClient apps) : IStepPusher
{
    private const string FleetKind = "fleet";
    private const string CourierKind = "courier";

    public string StepKey => StepKeys.Couriers;

    public static Needs Validate(CourierRow c)
        => new Needs()
            .Text(c.FirstName, "first name")
            .Text(c.SurName, "surname")
            .Text(c.Email, "email (their app sign-in)")
            .When(string.IsNullOrWhiteSpace(c.InitialPassword) || c.InitialPassword.Length < 8, "initial app password (8+ characters)")
            .When(c.CourierTypeId is not null and not (1 or 2 or 4), "courier type of Independent, Master or Gig");

    public async Task PushAsync(SetupSession session, CallerContext caller, CancellationToken ct)
    {
        var ledger = new RowLedger(session.Step(StepKey));

        foreach (var f in session.Couriers.Fleets)
        {
            var key = f.Name?.Trim() ?? string.Empty;
            if (ledger.AlreadyCreated(FleetKind, key, out _))
            {
                continue;
            }

            if (ledger.IsUnknown(FleetKind, key))
            {
                continue;
            }

            var row = ledger.Row(FleetKind, key.Length > 0 ? key : "(unnamed fleet)");
            var needs = new Needs().Text(f.Name, "name").When(key.Length > 50, "name of 50 characters or fewer");
            if (needs.Any) { RowLedger.NeedsData(row, needs.Items); continue; }

            var res = await apps.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/v1/np/fleets", new { name = key, depotId = f.DepotId }, ct);
            if (res.Ok)
            {
                RowLedger.Created(row, res.Id);
            }
            else
            {
                RowLedger.Failed(row, res);
            }
        }

        foreach (var c in session.Couriers.Couriers)
        {
            var key = c.Email?.Trim() ?? string.Empty;
            if (ledger.AlreadyCreated(CourierKind, key, out _) || ledger.IsUnknown(CourierKind, key)) { c.InitialPassword = null; continue; }
            var row = ledger.Row(CourierKind, key.Length > 0 ? key : $"{c.FirstName} {c.SurName}".Trim() is { Length: > 0 } n ? n : "(unnamed courier)");

            var needs = Validate(c);
            if (needs.Any) { RowLedger.NeedsData(row, needs.Items); continue; }

            var res = await apps.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/v1/np/fleet", new
            {
                firstName = c.FirstName!.Trim(),
                surName = c.SurName!.Trim(),
                email = key,
                password = c.InitialPassword,
                code = string.IsNullOrWhiteSpace(c.Code) ? null : c.Code.Trim(),
                mobile = c.Mobile?.Trim() ?? string.Empty,
                vehicleType = c.VehicleType?.Trim() ?? string.Empty,
                courierTypeId = c.CourierTypeId
            }, ct);

            // Used once: cleared whether or not the create worked. A retry needs the password typed again.
            c.InitialPassword = null;
            if (!res.Ok) { RowLedger.Failed(row, res); continue; }
            RowLedger.Created(row, res.Id,
                string.IsNullOrWhiteSpace(c.FleetName) ? null : $"Assign to fleet \"{c.FleetName}\" in Settings > Driver List.");
        }
    }
}
