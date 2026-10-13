using SetupDashboard.Models.TmsApi;

namespace SetupDashboard.Services.TmsApi;

/// <summary>
/// Fuel Surcharge Management — 5 tools from fuel.ts.
/// Uses /API/fuel (capital API).
/// 
/// QUIRK: API uses 'start'/'end' field names (not 'validStart'/'validEnd').
/// </summary>
public class FuelService : TmsServiceBase
{
    public FuelService(AdminManagerClient client) : base(client) { }

    public async Task<List<FuelSurcharge>> SearchFuelsAsync(string searchText = " ")
    {
        var json = await Client.PostRawAsync("/API/fuel/search", new { searchText });
        return ExtractArray<FuelSurcharge>(json, "fuels");
    }

    public async Task<string> GetFuelAsync(int fuelId)
        => await GetRawAsync($"/API/fuel/{fuelId}");

    public async Task<string> CreateFuelAsync(Dictionary<string, object?> fields)
    {
        if (!fields.ContainsKey("active")) fields["active"] = true;
        return await Client.PostRawAsync("/API/fuel", fields);
    }

    public async Task<string> UpdateFuelAsync(int fuelId, Dictionary<string, object?> updates)
        => await UpdateEntityAsync("/API/fuel", fuelId, "fuel", updates, "name");

    public async Task DeleteFuelAsync(int fuelId)
        => await Client.DeleteAsync($"/API/fuel/{fuelId}");
}
