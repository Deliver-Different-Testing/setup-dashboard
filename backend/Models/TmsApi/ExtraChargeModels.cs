namespace SetupDashboard.Models.TmsApi;

/// <summary>
/// Extra charge (legacy accessorial) from the unified /API/rate system.
/// </summary>
public class ExtraCharge
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public int? ClientId { get; set; }
    public string? ClientCode { get; set; }
    public int? RateCardId { get; set; }
    public string? RateCardName { get; set; }
    public bool Active { get; set; } = true;
}

/// <summary>
/// Accessorial charge (new system) - standalone charge definitions.
/// </summary>
public class AccessorialCharge
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string ChargeType { get; set; } = "flat"; // flat, per_unit, hourly, percentage, quote_based
    public string? UnitType { get; set; }
    public decimal? BaseRate { get; set; }
    public decimal? RatePerUnit { get; set; }
    public decimal? PercentageRate { get; set; }
    public decimal? MinimumCharge { get; set; }
    public decimal? MaximumCharge { get; set; }
    public decimal? MinimumQuantity { get; set; }
    public decimal? FreeAllowance { get; set; }
    public string? FreeAllowanceUnit { get; set; }
    public bool RequiresQuote { get; set; }
    public string? ConditionalNote { get; set; }
    public int CalculationOrder { get; set; }
    public bool Active { get; set; } = true;
}

/// <summary>
/// Accessorial charge group (read via rate composite endpoint).
/// </summary>
public class AccessorialChargeGroup
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public bool Active { get; set; }
    public int MemberCount { get; set; }
    public int RateCardId { get; set; }
    public string? RateCardName { get; set; }
}
