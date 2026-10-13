namespace SetupDashboard.Models.TmsApi;

public class TmsClient
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Code { get; set; }
    public bool Active { get; set; } = true;
    public int? GroupId { get; set; }
    public string? LegalName { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
}

public class Courier
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Code { get; set; }
    public string? FirstName { get; set; }
    public string? SurName { get; set; }
    public string? PersonalMobile { get; set; }
    public string? UrgentMobile { get; set; }
    public int CourierType { get; set; } = 1;
    public bool Active { get; set; } = true;
    public bool? Internal { get; set; }
    public string? VehicleRegoNo { get; set; }
    public string? Email { get; set; }
}

public class Staff
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public bool Active { get; set; }
}
