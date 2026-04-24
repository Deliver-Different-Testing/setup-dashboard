namespace SetupDashboard.Models.TmsApi;

public class Job
{
    public int Id { get; set; }
    public string? JobNo { get; set; }
    public string Status { get; set; } = "";
    public string? StatusName { get; set; }
    public string? Speed { get; set; }
    public int SpeedId { get; set; }
    public string? Client { get; set; }
    public int ClientId { get; set; }
    public string? ClientName { get; set; }
    public string? Booked { get; set; }
}

public class JobAddress
{
    public string? FullAddress { get; set; }
    public string? AddressLine5 { get; set; } // city
    public string? AddressLine6 { get; set; } // state
    public string? AddressLine7 { get; set; } // zip
}

public class CreateJobRequest
{
    public string PickupName { get; set; } = "";
    public string PickupContact { get; set; } = "";
    public string PickupStreet { get; set; } = "";
    public string PickupCity { get; set; } = "";
    public string PickupState { get; set; } = "";
    public string PickupZip { get; set; } = "";
    public string DeliveryName { get; set; } = "";
    public string DeliveryStreet { get; set; } = "";
    public string DeliveryCity { get; set; } = "";
    public string DeliveryState { get; set; } = "";
    public string DeliveryZip { get; set; } = "";
    public int Units { get; set; } = 1;
    public decimal WeightLb { get; set; } = 1;
    public decimal Cubic { get; set; } = 1;
    public int? SpeedId { get; set; }
    public string? Notes { get; set; }
    public int? ClientId { get; set; }
}
