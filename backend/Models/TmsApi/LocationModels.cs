namespace SetupDashboard.Models.TmsApi;

/// <summary>
/// Location/Depot entity. API endpoint is /API/bulkRegion (not /API/location).
/// API quirk: Create REQUIRES audit fields present as null — omitting causes 500.
/// </summary>
public class Location
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public bool Active { get; set; } = true;
    public string? FromCompany { get; set; }
    public string? FromAddress { get; set; }
    public string? FromSuburb { get; set; }
    public int? FromPostCode { get; set; }
    public string? AmericanStreetNumber { get; set; }
    public string? AmericanStreetName { get; set; }
    public string? AmericanCity { get; set; }
    public string? AmericanState { get; set; }
    public string? AmericanZipCode { get; set; }
    public string? Gps { get; set; }
}
