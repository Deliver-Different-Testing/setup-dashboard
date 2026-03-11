using SetupDashboard.Models.TmsApi;

namespace SetupDashboard.Services.TmsApi;

/// <summary>
/// Agent and Vehicle Management — 18 tools from agents.ts.
/// 
/// QUIRKS:
///   - GET /api/agentVehicle/{id} returns 405 → update without fetching current state
///   - GET /api/cargoFacility returns 405 (Angular scope, UI-only)
///   - Cargo facility create uses openingTime/closingTime (not openTime/closeTime)
///   - Carrier search uses /API/Carrier/Search (capital API)
/// </summary>
public class AgentService : TmsServiceBase
{
    public AgentService(AdminManagerClient client) : base(client) { }

    // --- Agents ---

    public async Task<List<Agent>> ListAgentsAsync()
    {
        var json = await GetRawAsync("/api/agent");
        return ExtractArray<Agent>(json, "agents");
    }

    public async Task<string> GetAgentAsync(int agentId)
        => await GetRawAsync($"/api/agent/{agentId}");

    public async Task<List<Agent>> SearchAgentsAsync(string searchText)
    {
        var json = await Client.PostRawAsync("/api/agent/search", new { SearchText = searchText });
        return ExtractArray<Agent>(json, "agents");
    }

    public async Task<string> CreateAgentAsync(Dictionary<string, object?> fields)
        => await Client.PostRawAsync("/api/agent", fields);

    public async Task<string> UpdateAgentAsync(int agentId, Dictionary<string, object?> updates)
        => await UpdateEntityAsync("/api/agent", agentId, "agent", updates, "suburb", "site", "gps");

    public async Task DeleteAgentAsync(int agentId)
        => await Client.DeleteAsync($"/api/agent/{agentId}");

    // --- Agent Vehicles ---

    public async Task<List<AgentVehicle>> ListAgentVehiclesAsync(int? agentId = null)
    {
        var endpoint = agentId.HasValue ? $"/api/agentVehicle?agentId={agentId}" : "/api/agentVehicle";
        var json = await GetRawAsync(endpoint);
        return ExtractArray<AgentVehicle>(json, "agentVehicles");
    }

    public async Task<string> CreateAgentVehicleAsync(int agentId, int airportId, int vehicleSizeId, int distanceRateId)
        => await Client.PostRawAsync("/api/agentVehicle", new { agentId, airportId, vehicleSizeId, distanceRateId });

    public async Task<BulkOperationResult> BulkCreateAgentVehiclesAsync(List<AgentVehicle> vehicles)
    {
        var items = vehicles.Select(v => (object)new { v.AgentId, v.AirportId, v.VehicleSizeId, v.DistanceRateId }).ToList();
        return await BulkCreateAsync("/api/agentVehicle", items, new BulkOptions { BatchSize = 50, DelayMs = 100 });
    }

    /// <summary>
    /// Update agent vehicle. GET returns 405, so POST directly without fetching current state.
    /// Caller should provide all fields they want to keep.
    /// </summary>
    public async Task<string> UpdateAgentVehicleAsync(int agentVehicleId, Dictionary<string, object?> fields)
    {
        fields["id"] = agentVehicleId;
        return await Client.PostRawAsync($"/api/agentVehicle/{agentVehicleId}", fields);
    }

    public async Task DeleteAgentVehicleAsync(int agentVehicleId)
        => await Client.DeleteAsync($"/api/agentVehicle/{agentVehicleId}");

    // --- Cargo Facilities ---

    public async Task<List<CargoFacility>> ListCargoFacilitiesAsync(int? airportId = null)
    {
        var endpoint = airportId.HasValue ? $"/api/cargoFacility?airportId={airportId}" : "/api/cargoFacility";
        var json = await GetRawAsync(endpoint);
        return ExtractArray<CargoFacility>(json, "cargoFacilities");
    }

    /// <summary>
    /// Create cargo facility. Note: API uses openingTime/closingTime field names.
    /// </summary>
    public async Task<string> CreateCargoFacilityAsync(int airportId, int carrierId, string openTime, string closeTime)
        => await Client.PostRawAsync("/api/cargoFacility", new { airportId, carrierId, openingTime = openTime, closingTime = closeTime });

    public async Task<BulkOperationResult> BulkCreateCargoFacilitiesAsync(List<CargoFacility> facilities)
    {
        var items = facilities.Select(f => (object)new { f.AirportId, f.CarrierId, openingTime = f.OpenTime, closingTime = f.CloseTime }).ToList();
        return await BulkCreateAsync("/api/cargoFacility", items, new BulkOptions { BatchSize = 50, DelayMs = 100 });
    }

    /// <summary>
    /// Update cargo facility. GET returns 405, so POST directly.
    /// </summary>
    public async Task<string> UpdateCargoFacilityAsync(int cargoFacilityId, Dictionary<string, object?> fields)
    {
        fields["id"] = cargoFacilityId;
        // Map field names to API names
        if (fields.ContainsKey("openTime")) { fields["openingTime"] = fields["openTime"]; fields.Remove("openTime"); }
        if (fields.ContainsKey("closeTime")) { fields["closingTime"] = fields["closeTime"]; fields.Remove("closeTime"); }
        return await Client.PostRawAsync($"/api/cargoFacility/{cargoFacilityId}", fields);
    }

    public async Task DeleteCargoFacilityAsync(int cargoFacilityId)
        => await Client.DeleteAsync($"/api/cargoFacility/{cargoFacilityId}");

    // --- Lookups ---

    public async Task<List<Airport>> ListAirportsAsync()
    {
        var json = await GetRawAsync("/api/airport");
        return ExtractArray<Airport>(json, "airports");
    }

    public async Task<List<Carrier>> ListCarriersAsync()
    {
        var json = await GetRawAsync("/api/carrier");
        return ExtractArray<Carrier>(json, "carriers");
    }

    /// <summary>Search carriers. Uses /API/Carrier/Search (capital API).</summary>
    public async Task<List<Carrier>> SearchCarriersAsync(string searchText = "")
    {
        var json = await Client.PostRawAsync("/API/Carrier/Search", new { searchText });
        return ExtractArray<Carrier>(json, "carriers");
    }

    public async Task<List<VehicleSize>> ListVehicleSizesAsync()
    {
        var json = await GetRawAsync("/api/vehicleSize");
        return ExtractArray<VehicleSize>(json, "vehicleSizes");
    }

    public async Task<List<DistanceRate>> ListDistanceRatesAsync()
    {
        var json = await GetRawAsync("/api/rate");
        return ExtractArray<DistanceRate>(json, "rates");
    }
}
