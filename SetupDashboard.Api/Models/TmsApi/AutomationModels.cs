namespace SetupDashboard.Models.TmsApi;

public class TmsAutomationRule
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public List<Dictionary<string, object?>>? Conditions { get; set; }
    public List<Dictionary<string, object?>>? Actions { get; set; }
}
