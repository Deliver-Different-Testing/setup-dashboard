namespace SetupDashboard.Models;

// A tenant's onboarding journey. Owned by the tenant in the caller's Hub cookie
// (CurrentTenantID); the store refuses to hand a session to any other tenant.
//
// NO DEFAULTS ON DATA. Every field the dashboard sends to Settings / Routed Ops
// is nullable here and starts empty. A row missing something the target API
// requires is reported as "needs: <field>" and never sent - the old dashboard
// filled gaps with "123 Main St, NY 10001", which is the bug this replaces.
public class SetupSession
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..12];
    public int TenantId { get; set; }
    public string? TenantCode { get; set; }
    public int? CreatedByContactId { get; set; }
    public string? CreatedByName { get; set; }
    public int CurrentStep { get; set; }
    public Dictionary<string, StepState> Steps { get; set; } = StepKeys.All.ToDictionary(k => k, k => new StepState { Key = k });

    public BusinessProfile Business { get; set; } = new();
    public TeamStep Team { get; set; } = new();
    public List<ClientRow> Clients { get; set; } = new();
    public RatesStep Rates { get; set; } = new();
    public List<ScheduleRow> Schedules { get; set; } = new();
    public CouriersStep Couriers { get; set; } = new();
    public List<PartnerRow> Partners { get; set; } = new();
    public List<TrainingMember> TrainingProgress { get; set; } = new();

    public string Status { get; set; } = "active";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public StepState Step(string key)
    {
        if (!Steps.TryGetValue(key, out var s))
        {
            s = new StepState { Key = key };
            Steps[key] = s;
        }
        return s;
    }
}

public static class StepKeys
{
    public const string Business = "business";
    public const string Team = "team";
    public const string Clients = "clients";
    public const string Rates = "rates";
    public const string Schedules = "schedules";
    public const string Couriers = "couriers";
    public const string Partners = "partners";
    public const string Automations = "automations";
    public const string Integrations = "integrations";
    public const string AppConfig = "appconfig";
    public const string Training = "training";

    public static readonly string[] All =
        [Business, Team, Clients, Rates, Schedules, Couriers, Partners, Automations, Integrations, AppConfig, Training];
}

// ── Progress ────────────────────────────────────────────────────────────────

public static class StepStatus
{
    public const string NotStarted = "not_started";
    public const string WaitingOnTenant = "waiting_on_tenant";
    public const string InProgress = "in_progress";
    public const string Done = "done";
}

public class StepState
{
    public string Key { get; set; } = "";
    public string Status { get; set; } = StepStatus.NotStarted;
    public List<DataRequest> Requests { get; set; } = new();
    public List<RowResult> Rows { get; set; } = new();
    public List<ChecklistItem> Checklist { get; set; } = new();
    public DateTime? CompletedAt { get; set; }
    public string? CompletedBy { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Something DFRNT asked the tenant for. Open while FulfilledAt is null.</summary>
public class DataRequest
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];
    public string Item { get; set; } = "";
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public string? RequestedBy { get; set; }
    public DateTime? DueBy { get; set; }
    public DateTime? FulfilledAt { get; set; }
    public string? FulfilledBy { get; set; }
}

/// <summary>Outcome of one record pushed to its owning app, keyed by a natural key (code, email, name).</summary>
public class RowResult
{
    public string Key { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Status { get; set; } = RowStatus.Pending;
    public int? EntityId { get; set; }
    public List<string> Needs { get; set; } = new();
    public List<string> Errors { get; set; } = new();
    public string? Notice { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public static class RowStatus
{
    public const string Pending = "pending";
    public const string NeedsData = "needs_data";
    public const string Created = "created";
    public const string Failed = "failed";
    public const string Skipped = "skipped";
    /// <summary>Sent, but no answer came back: it may exist in the target app. Not re-sent until someone chooses Send again.</summary>
    public const string Unknown = "unknown";
}

/// <summary>Work that has no API yet, or is done in another app's screens. Ticked by a person.</summary>
public class ChecklistItem
{
    public string Id { get; set; } = "";
    public string Item { get; set; } = "";
    public string Owner { get; set; } = "DFRNT";
    public string? Link { get; set; }
    public bool Required { get; set; }
    public DateTime? DoneAt { get; set; }
    public string? DoneBy { get; set; }
}

// ── Step 0: Business ────────────────────────────────────────────────────────

public class BusinessProfile
{
    public string? CompanyName { get; set; }
    public string? LegalName { get; set; }
    public string? Country { get; set; }
    public List<string> Geography { get; set; } = new();
    public List<string> Verticals { get; set; } = new();
    public string? CurrentSystem { get; set; }
    public string? DeliveriesPerMonth { get; set; }
    public string? RegistrationNumber { get; set; }
    public string? StateOfIncorporation { get; set; }
    public string? BusinessType { get; set; }
    public ContactInfo PrimaryContact { get; set; } = new();
}

public class ContactInfo
{
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Title { get; set; }
}

// ── Step 1: Team ────────────────────────────────────────────────────────────

public class TeamStep
{
    public List<RoleRow> Roles { get; set; } = new();
    public List<PersonRow> People { get; set; } = new();
}

/// <summary>A Settings role tagged Tenant Staff. Tiles are hub-tile-* keys switched on in Access Control.</summary>
public class RoleRow
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public List<string> Tiles { get; set; } = new();
}

/// <summary>A tenant staff member. Created on the tenant's own client (ClientTypeId 4); never a staff file.</summary>
public class PersonRow
{
    public string? Email { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? JobTitle { get; set; }
    public string? Mobile { get; set; }
    public string? RoleName { get; set; }
    /// <summary>Creating the person sends a Hub sign-in invite. Nothing is sent until this is ticked.</summary>
    public bool InviteConfirmed { get; set; }
}

// ── Step 2: Clients ─────────────────────────────────────────────────────────

/// <summary>A customer (ClientTypeId 2), shaped to Settings POST /api/v1/tenant/clients.</summary>
public class ClientRow
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? Address { get; set; }
    public string? Unit { get; set; }
    public string? Suburb { get; set; }
    public string? City { get; set; }
    public string? PostCode { get; set; }
    public string? Country { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? InvoiceEmail { get; set; }
    public int? InvoiceScheduleId { get; set; }
    public int? PaymentTermId { get; set; }
    public string? InvoiceMethod { get; set; }
    public string? Notes { get; set; }
    /// <summary>
    /// Settings creates the primary contact's Hub sign-in with the customer and emails them an
    /// invite (TenantClientsController.Create, no opt-out). Nothing is sent until this is ticked.
    /// </summary>
    public bool InviteConfirmed { get; set; }
    public ClientContactRow PrimaryContact { get; set; } = new();
    public List<ClientContactRow> Contacts { get; set; } = new();
}

public class ClientContactRow
{
    public string? FirstName { get; set; }
    public string? Surname { get; set; }
    public string? Email { get; set; }
    public string? Mobile { get; set; }
    public string? JobTitle { get; set; }
    /// <summary>Booking sign-in for an extra contact sends an invite; off unless ticked.</summary>
    public bool CreateSignIn { get; set; }
}

// ── Step 3: Rates & zones (Settings Rates & Pricing) ────────────────────────

public class RatesStep
{
    public List<VehicleSizeRow> VehicleSizes { get; set; } = new();
    public List<ZoneGroupRow> ZoneGroups { get; set; } = new();
    public List<FuelSurchargeRow> FuelSurcharges { get; set; } = new();
    public List<ZoneRateRow> ZoneRates { get; set; } = new();
    public List<DistanceRateRow> DistanceRates { get; set; } = new();
}

public class VehicleSizeRow
{
    public string? Name { get; set; }
    public decimal? CubicCapacity { get; set; }
    public int? PalletCapacity { get; set; }
    public decimal? WeightCapacity { get; set; }
    /// <summary>Percent as entered (12.5 = 12.5%). Sent to Settings as a fraction.</summary>
    public decimal? FuelPercent { get; set; }
}

public class ZoneGroupRow
{
    public string? Name { get; set; }
    public List<ZoneRow> Zones { get; set; } = new();
}

public class ZoneRow
{
    public string? Name { get; set; }
    public List<string> Zips { get; set; } = new();
}

public class FuelSurchargeRow
{
    public string? Name { get; set; }
    /// <summary>Percent as entered. Sent as a fraction.</summary>
    public decimal? RatePercent { get; set; }
    public DateTime? Start { get; set; }
    /// <summary>Blank = applies generally. Settings fuel surcharges carry a single optional client.</summary>
    public string? ClientCode { get; set; }
}

public class ZoneRateRow
{
    public string? Name { get; set; }
    public string? FromZone { get; set; }
    public string? ToZone { get; set; }
    public int? SpeedId { get; set; }
    /// <summary>Vehicle sizes by name: ones created earlier in this step have no id yet.</summary>
    public List<string> VehicleSizeNames { get; set; } = new();
    public decimal? ChargeRate { get; set; }
    public decimal? DriverRate { get; set; }
    /// <summary>Empty means the rate applies to every customer. The push states that explicitly.</summary>
    public List<string> ClientCodes { get; set; } = new();
}

public class DistanceRateRow
{
    public string? Name { get; set; }
    public int? SpeedId { get; set; }
    /// <summary>Vehicle sizes by name: ones created earlier in this step have no id yet.</summary>
    public List<string> VehicleSizeNames { get; set; } = new();
    public decimal? BaseCharge { get; set; }
    public decimal? BaseChargeDriver { get; set; }
    public decimal? PerDistanceUnit { get; set; }
    public decimal? PerDistanceUnitDriver { get; set; }
    public decimal? DistanceIncluded { get; set; }
    public List<int> DepotIds { get; set; } = new();
    public List<string> ClientCodes { get; set; } = new();
}

// ── Step 4: Schedules (Routed Ops) ──────────────────────────────────────────

public class ScheduleRow
{
    public string? Name { get; set; }
    /// <summary>Destination depot (tblBulkRegion).</summary>
    public int? RegionId { get; set; }
    public int? PickupDepotId { get; set; }
    /// <summary>depot | client | direct</summary>
    public string? OriginType { get; set; }
    public int? OriginRegionId { get; set; }
    public int? SpeedId { get; set; }
    public List<DayWindowRow> DayWindows { get; set; } = new();
    /// <summary>Empty = default schedule for every client (not allowed for client origin).</summary>
    public List<string> ClientCodes { get; set; } = new();
}

public class DayWindowRow
{
    /// <summary>ISO day, 1 = Monday.</summary>
    public short? DayOfWeek { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public int? CutoffDay { get; set; }
    public string? CutoffTime { get; set; }
}

// ── Step 5: Couriers (Settings Driver List / Vehicle Fleets) ────────────────

public class CouriersStep
{
    public List<FleetRow> Fleets { get; set; } = new();
    public List<CourierRow> Couriers { get; set; } = new();
}

public class FleetRow
{
    public string? Name { get; set; }
    public int? DepotId { get; set; }
}

public class CourierRow
{
    public string? Email { get; set; }
    public string? FirstName { get; set; }
    public string? SurName { get; set; }
    public string? Code { get; set; }
    public string? Mobile { get; set; }
    public string? VehicleType { get; set; }
    public int? CourierTypeId { get; set; }
    public string? FleetName { get; set; }
    /// <summary>
    /// Initial app password, typed by the operator (D2). Required by Settings
    /// courier create. Cleared from the session as soon as the courier is
    /// created, and never returned by any GET.
    /// </summary>
    public string? InitialPassword { get; set; }
}

// ── Step 6: Partners (Settings Agents & Network Partners) ───────────────────

public class PartnerRow
{
    public string? Name { get; set; }
    public bool IsNetworkPartner { get; set; } = true;
    public string? ContactName { get; set; }
    public string? ContactEmail { get; set; }
    public int? PrimaryContactRoleId { get; set; }
    public string? Phone { get; set; }
    public string? AddressLine1 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? PostCode { get; set; }
    /// <summary>Percent as entered. Sent as a fraction (0,1].</summary>
    public decimal? DefaultCourierPayPercent { get; set; }
    public bool InviteConfirmed { get; set; }
}

// ── Training + tenant summary (unchanged behaviour) ─────────────────────────

public class TenantSummary
{
    public Dictionary<string, string> Settings { get; set; } = new();
    public TenantCounts Counts { get; set; } = new();
}

public class TenantCounts
{
    public int Team { get; set; }
    public int Clients { get; set; }
    public int Contacts { get; set; }
    public int Couriers { get; set; }
    public int Zones { get; set; }
    public int Automations { get; set; }
    public int Services { get; set; }
}

public class TrainingMember
{
    public string UserEmail { get; set; } = "";
    public string? UserName { get; set; }
    public string? Role { get; set; }
    public int Xp { get; set; }
    public List<string> CompletedChallenges { get; set; } = new();
    public int CurrentStreak { get; set; }
    public string? LastActive { get; set; }
}
