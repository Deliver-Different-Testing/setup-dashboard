namespace SetupDashboard.Models.TmsApi;

public class FuelSurcharge
{
    public int Id { get; set; }
    public string? Name { get; set; }
    /// <summary>Valid start date. API uses 'start' field name (not 'validStart').</summary>
    public string Start { get; set; } = "";
    /// <summary>Valid end date. API uses 'end' field name (not 'validEnd').</summary>
    public string? End { get; set; }
    public decimal Rate { get; set; }
    public decimal? PumpPrice { get; set; }
    public int? ClientId { get; set; }
    public int? VehicleSizeId { get; set; }
    public bool Active { get; set; } = true;
}
