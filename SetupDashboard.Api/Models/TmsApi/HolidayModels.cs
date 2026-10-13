namespace SetupDashboard.Models.TmsApi;

public class Holiday
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Type { get; set; }
    public string? Date { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public bool CanBook { get; set; }
    public int? ClientId { get; set; }
    public int? SpeedId { get; set; }
    public int? CourierId { get; set; }
    public bool AllSpeeds { get; set; } = true;
    public decimal Amount { get; set; }
    public string? Message { get; set; }
    public string? Notes { get; set; }
    public int SiteId { get; set; }
}
