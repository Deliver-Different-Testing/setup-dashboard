using SetupDashboard.Models.TmsApi;

namespace SetupDashboard.Services.TmsApi;

/// <summary>
/// Client, Courier, and Staff Management — 14 tools from clients.ts.
/// </summary>
public class ClientService : TmsServiceBase
{
    public ClientService(AdminManagerClient client) : base(client) { }

    // --- Clients ---

    public async Task<List<TmsClient>> ListClientsAsync()
    {
        var json = await GetRawAsync("/api/client");
        return ExtractArray<TmsClient>(json, "clients");
    }

    public async Task<List<TmsClient>> SearchClientsAsync(string searchText)
    {
        var json = await Client.PostRawAsync("/api/client/search", new { SearchText = searchText });
        return ExtractArray<TmsClient>(json, "clients");
    }

    public async Task<string> GetClientAsync(int clientId)
        => await GetRawAsync($"/api/client/{clientId}");

    public async Task<string> CreateClientAsync(Dictionary<string, object?> fields)
        => await Client.PostRawAsync("/api/client", fields);

    public async Task<string> UpdateClientAsync(int clientId, Dictionary<string, object?> updates)
        => await UpdateEntityAsync("/api/client", clientId, "client", updates, "suburb", "site", "gps");

    public async Task DeleteClientAsync(int clientId)
        => await Client.DeleteAsync($"/api/client/{clientId}");

    // --- Couriers ---

    public async Task<List<Models.TmsApi.Courier>> ListCouriersAsync()
    {
        var json = await GetRawAsync("/api/courier");
        return ExtractArray<Models.TmsApi.Courier>(json, "couriers");
    }

    public async Task<List<Models.TmsApi.Courier>> SearchCouriersAsync(string searchText)
    {
        var json = await Client.PostRawAsync("/api/courier/search", new { SearchText = searchText });
        return ExtractArray<Models.TmsApi.Courier>(json, "couriers");
    }

    public async Task<string> GetCourierAsync(int courierId)
        => await GetRawAsync($"/api/courier/{courierId}");

    /// <summary>
    /// Create courier. courierType defaults to 1 if not provided.
    /// </summary>
    public async Task<string> CreateCourierAsync(Dictionary<string, object?> fields)
    {
        if (!fields.ContainsKey("courierType")) fields["courierType"] = 1;
        return await Client.PostRawAsync("/api/courier", fields);
    }

    public async Task<string> UpdateCourierAsync(int courierId, Dictionary<string, object?> updates)
        => await UpdateEntityAsync("/api/courier", courierId, "courier", updates, "suburb", "site", "gps");

    public async Task DeleteCourierAsync(int courierId)
        => await Client.DeleteAsync($"/api/courier/{courierId}");

    // --- Staff ---

    public async Task<List<Staff>> ListStaffAsync()
    {
        var json = await GetRawAsync("/api/staff");
        return ExtractArray<Staff>(json, "staff", "staffs");
    }

    public async Task<string> GetStaffAsync(int staffId)
        => await GetRawAsync($"/api/staff/{staffId}");

    // --- User Setup (atomic Staff + Contact + User creation) ---

    public async Task<string> GetUserSetupInitAsync()
        => await GetRawAsync("/API/UserSetup");

    public async Task<string> CreateUserSetupAsync(Dictionary<string, object?> fields)
        => await Client.PostRawAsync("/API/UserSetup", fields);
}
