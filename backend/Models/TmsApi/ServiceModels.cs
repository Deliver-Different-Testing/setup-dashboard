namespace SetupDashboard.Models.TmsApi;

public class TmsService
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int? Region1SpeedId { get; set; }
    public string? Region1SpeedName { get; set; }
    public int? Region2SpeedId { get; set; }
    public string? Region2SpeedName { get; set; }
}

public class Speed
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? ShortName { get; set; }
    public string? Code { get; set; }
    public int? ClientId { get; set; }
}

public class SpeedGrouping
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}
