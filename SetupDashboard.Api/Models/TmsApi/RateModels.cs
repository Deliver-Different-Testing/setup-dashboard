namespace SetupDashboard.Models.TmsApi;

public class RateCard
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int? ClientId { get; set; }
    public int? SpeedId { get; set; }
    public int? VehicleId { get; set; }
    public bool Active { get; set; } = true;
}

public class BreakGroup
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int RateCardId { get; set; }
    public int ServiceTypeId { get; set; }
}

public class WeightBreak
{
    public int Id { get; set; }
    public int BreakGroupId { get; set; }
    public decimal MinWeight { get; set; }
    public decimal MaxWeight { get; set; }
    public decimal Rate { get; set; }
}

public class ZoneRate
{
    public int Id { get; set; }
    public int ZoneNameId { get; set; }
    public int OriginZone { get; set; }
    public int DestinationZone { get; set; }
    public int BreakGroupId { get; set; }
}

public class DistanceRate
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int RateCardId { get; set; }
    public int ClientId { get; set; }
    public int SpeedId { get; set; }
    public string Vehicle { get; set; } = "";
    public decimal StartDistance { get; set; }
    public decimal EndDistance { get; set; }
    public int WeightBreakGroupId { get; set; }
    public bool ApplyBaseChargeFuel { get; set; }
    public decimal? BaseCharge { get; set; }
    public decimal? PerDistanceUnit { get; set; }
    public decimal? DistanceIncluded { get; set; }
    public int? ExtraChargeId { get; set; }
}

public class BreakType
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}
