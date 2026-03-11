using SetupDashboard.Models.TmsApi;

namespace SetupDashboard.Services.TmsApi;

/// <summary>
/// Location/Depot Management — 4 tools from locations.ts.
/// 
/// QUIRKS:
///   - Endpoint is /API/bulkRegion (not /API/depot or /API/location)
///   - GET response wraps in { bulkRegion: {...} }
///   - POST for create and POST /{id} for update (NOT PUT)
///   - Create REQUIRES audit fields present as null — omitting causes 500
///   - fromPostCode is numeric (int), not string
/// </summary>
public class LocationService : TmsServiceBase
{
    public LocationService(AdminManagerClient client) : base(client) { }

    public async Task<string> GetLocationAsync(int locationId)
        => await GetRawAsync($"/API/bulkRegion/{locationId}");

    /// <summary>
    /// Create location. API quirk: ALL fields including audit fields must be sent as null.
    /// </summary>
    public async Task<string> CreateLocationAsync(Dictionary<string, object?> fields)
    {
        // API requires audit fields present as null — omitting causes 500
        var payload = new Dictionary<string, object?>
        {
            ["id"] = 0,
            ["name"] = fields.GetValueOrDefault("name"),
            ["active"] = fields.GetValueOrDefault("active") ?? true,
            ["fromCompany"] = fields.GetValueOrDefault("fromCompany"),
            ["fromAddress"] = fields.GetValueOrDefault("fromAddress"),
            ["fromSuburb"] = fields.GetValueOrDefault("fromSuburb") ?? "",
            ["fromPostCode"] = fields.GetValueOrDefault("fromPostCode") ?? 0,
            ["americanCompany"] = null,
            ["americanStreetNumber"] = fields.GetValueOrDefault("americanStreetNumber") ?? "",
            ["americanStreetName"] = fields.GetValueOrDefault("americanStreetName") ?? "",
            ["americanCity"] = fields.GetValueOrDefault("americanCity") ?? "",
            ["americanState"] = fields.GetValueOrDefault("americanState") ?? "",
            ["americanZipCode"] = fields.GetValueOrDefault("americanZipCode") ?? "",
            ["gps"] = fields.GetValueOrDefault("gps") ?? "",
            ["created"] = null,
            ["createdBy"] = null,
            ["lastModified"] = null,
            ["lastModifiedBy"] = null,
        };
        return await Client.PostRawAsync("/API/bulkRegion", payload);
    }

    /// <summary>Update location. Uses POST (not PUT).</summary>
    public async Task<string> UpdateLocationAsync(int locationId, Dictionary<string, object?> updates)
        => await UpdateEntityAsync("/API/bulkRegion", locationId, "bulkRegion", updates);

    public async Task DeleteLocationAsync(int locationId)
        => await Client.DeleteAsync($"/API/bulkRegion/{locationId}");
}
