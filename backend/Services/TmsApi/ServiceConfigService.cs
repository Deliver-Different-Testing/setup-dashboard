using SetupDashboard.Models.TmsApi;

namespace SetupDashboard.Services.TmsApi;

/// <summary>
/// Service and Speed Management — 11 tools from services.ts.
/// 
/// QUIRKS:
///   - Speed create requires groupingId but API doesn't document it → defaults to 1 (Excelerator)
///   - Services map two regional Speeds together
/// </summary>
public class ServiceConfigService : TmsServiceBase
{
    public ServiceConfigService(AdminManagerClient client) : base(client) { }

    // --- Services ---

    public async Task<List<TmsService>> SearchServicesAsync(string searchText = " ")
    {
        var json = await Client.PostRawAsync("/api/service/search", new { searchText });
        return ExtractArray<TmsService>(json, "services");
    }

    public async Task<string> GetServiceAsync(int serviceId)
        => await GetRawAsync($"/api/service/{serviceId}");

    public async Task<string> CreateServiceAsync(Dictionary<string, object?> fields)
        => await Client.PostRawAsync("/api/service", fields);

    public async Task<string> UpdateServiceAsync(int serviceId, Dictionary<string, object?> updates)
        => await UpdateEntityAsync("/api/service", serviceId, "service", updates, "region1SpeedName", "region2SpeedName");

    public async Task DeleteServiceAsync(int serviceId)
        => await Client.DeleteAsync($"/api/service/{serviceId}");

    /// <summary>Get services linked to a speed via a specific column.</summary>
    public async Task<string> ListServicesBySpeedAsync(int speedId, string column)
        => await GetRawAsync($"/api/service/{speedId}/{column}");

    // --- Speeds ---

    public async Task<List<Speed>> SearchSpeedsAsync(string searchText = " ")
    {
        var json = await Client.PostRawAsync("/api/speed/search", new { searchText });
        return ExtractArray<Speed>(json, "speeds");
    }

    /// <summary>
    /// Create speed. groupingId defaults to 1 (Excelerator) if not provided.
    /// shortName defaults to first 10 chars of name.
    /// </summary>
    public async Task<string> CreateSpeedAsync(Dictionary<string, object?> fields)
    {
        if (!fields.ContainsKey("groupingId")) fields["groupingId"] = 1;
        if (!fields.ContainsKey("shortName") && fields.ContainsKey("name"))
            fields["shortName"] = ((string)fields["name"]!).Length > 10
                ? ((string)fields["name"]!)[..10]
                : fields["name"];
        return await Client.PostRawAsync("/api/speed", fields);
    }

    public async Task<string> UpdateSpeedAsync(int speedId, Dictionary<string, object?> updates)
        => await UpdateEntityAsync("/api/speed", speedId, "speed", updates);

    public async Task DeleteSpeedAsync(int speedId)
        => await Client.DeleteAsync($"/api/speed/{speedId}");

    // --- Speed Groupings ---

    public async Task<List<SpeedGrouping>> ListSpeedGroupingsAsync()
    {
        var json = await GetRawAsync("/api/speedGrouping");
        return ExtractArray<SpeedGrouping>(json, "speedGroupings");
    }
}
