namespace SetupDashboard.Models.TmsApi;

public class Contact
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public int? ClientId { get; set; }
    public string? Email { get; set; }
    public string? JobTitle { get; set; }
    public bool Active { get; set; } = true;
    public string? DirectDial { get; set; }
    public string? Mobile { get; set; }
    public string? Notes { get; set; }
}

public class ClientContact
{
    public int Id { get; set; }
    public int ClientId { get; set; }
    public int ContactId { get; set; }
    public bool Default { get; set; }
    public string? ClientName { get; set; }
}
