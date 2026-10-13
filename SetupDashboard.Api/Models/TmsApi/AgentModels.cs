namespace SetupDashboard.Models.TmsApi;

public class Agent
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Code { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? AmericanCity { get; set; }
    public string? AmericanState { get; set; }
    public string? AmericanZipCode { get; set; }
    public string? Notes { get; set; }
}

public class AgentVehicle
{
    public int Id { get; set; }
    public int AgentId { get; set; }
    public int AirportId { get; set; }
    public int VehicleSizeId { get; set; }
    public int DistanceRateId { get; set; }
}

public class CargoFacility
{
    public int Id { get; set; }
    public int AirportId { get; set; }
    public int CarrierId { get; set; }
    public string OpenTime { get; set; } = "";
    public string CloseTime { get; set; } = "";
}

public class Airport
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Code { get; set; }
}

public class Carrier
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}

public class VehicleSize
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}
