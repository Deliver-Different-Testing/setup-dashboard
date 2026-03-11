using SetupDashboard.Models.TmsApi;

namespace SetupDashboard.Services.TmsApi;

/// <summary>
/// System and Reference Data — 18+ tools from system.ts.
/// Read-only lookups for speeds, suburbs, statuses, users, settings, etc.
/// </summary>
public class SystemService : TmsServiceBase
{
    public SystemService(AdminManagerClient client) : base(client) { }

    // --- Speeds ---

    public async Task<List<Speed>> ListSpeedsAsync()
    {
        var json = await GetRawAsync("/api/speed");
        return ExtractArray<Speed>(json, "speeds");
    }

    public async Task<string> GetSpeedAsync(int speedId)
        => await GetRawAsync($"/api/speed/{speedId}");

    // --- Suburbs ---

    public async Task<List<Suburb>> ListSuburbsAsync()
    {
        var json = await GetRawAsync("/api/suburb");
        return ExtractArray<Suburb>(json, "suburbs");
    }

    public async Task<string> GetSuburbAsync(int suburbId)
        => await GetRawAsync($"/api/suburb/{suburbId}");

    public async Task<List<Suburb>> SearchSuburbsAsync(string searchText)
    {
        try
        {
            var json = await Client.PostRawAsync("/api/suburb/search", new { SearchText = searchText });
            return ExtractArray<Suburb>(json, "suburbs");
        }
        catch
        {
            // Fallback: filter from full list if search endpoint doesn't exist
            var all = await ListSuburbsAsync();
            var lower = searchText.ToLowerInvariant();
            return all.Where(s =>
                (s.Name?.ToLowerInvariant().Contains(lower) ?? false) ||
                (s.PostCode?.Contains(searchText) ?? false)).ToList();
        }
    }

    // --- Account Statuses ---

    public async Task<List<AccountStatus>> ListAccountStatusesAsync()
    {
        var json = await GetRawAsync("/api/accountStatus");
        return ExtractArray<AccountStatus>(json, "accountStatuses", "accountStatus");
    }

    public async Task<string> GetAccountStatusAsync(int id)
        => await GetRawAsync($"/api/accountStatus/{id}");

    // --- Job Statuses ---

    public async Task<List<JobStatus>> ListJobStatusesAsync()
    {
        var json = await GetRawAsync("/api/jobStatus");
        return ExtractArray<JobStatus>(json, "jobStatuses", "jobStatus");
    }

    // --- Event Types ---

    public async Task<List<EventType>> ListEventTypesAsync()
    {
        var json = await GetRawAsync("/api/eventType");
        return ExtractArray<EventType>(json, "eventTypes");
    }

    public async Task<string> GetEventTypeTemplateDetailsAsync(int eventTypeId)
        => await GetRawAsync($"/API/EventType/{eventTypeId}/templateDetails");

    public async Task<string> GetEventTypeRecipientGroupsAsync(int eventTypeId)
        => await GetRawAsync($"/API/EventType/{eventTypeId}/recipientGroups");

    public async Task<string> GetEventTypeGroupsAsync(int eventTypeId)
        => await GetRawAsync($"/API/EventType/{eventTypeId}/eventTypeGroups");

    public async Task<string> GetEventTypeNoteTypesAsync(int eventTypeId)
        => await GetRawAsync($"/API/EventType/{eventTypeId}/noteTypes");

    // --- Service Tracking ---

    public async Task<List<ServiceTracking>> ListServiceTrackingAsync()
    {
        var json = await GetRawAsync("/api/serviceTracking");
        return ExtractArray<ServiceTracking>(json, "serviceTrackings", "serviceTracking");
    }

    // --- Users ---

    public async Task<List<TmsUser>> ListUsersAsync()
    {
        var json = await GetRawAsync("/api/user");
        return ExtractArray<TmsUser>(json, "users");
    }

    public async Task<string> GetUserAsync(int userId)
        => await GetRawAsync($"/api/user/{userId}");

    // --- Settings ---

    public async Task<string> ListSettingsAsync()
        => await GetRawAsync("/api/setting");

    // --- Audit History ---

    /// <summary>
    /// Get audit trail for any TMS entity.
    /// Uses /API/History/{id}/{table} (capital API).
    /// </summary>
    public async Task<string> GetHistoryAsync(int entityId, string table)
        => await GetRawAsync($"/API/History/{entityId}/{table}");

    // --- Categories ---

    public async Task<List<Category>> ListCategoriesAsync()
    {
        var json = await GetRawAsync("/API/Category");
        return ExtractArray<Category>(json, "categories");
    }

    public async Task<List<Category>> SearchCategoriesAsync(string searchText = "")
    {
        var json = await Client.PostRawAsync("/API/Category/Search", new { searchText });
        return ExtractArray<Category>(json, "categories");
    }

    // --- Sites ---

    public async Task<List<Site>> SearchSitesAsync(string searchText = "")
    {
        var json = await Client.PostRawAsync("/API/Site/Search", new { searchText });
        return ExtractArray<Site>(json, "sites");
    }

    // --- Clear List Areas ---

    public async Task<List<ClearListArea>> ListClearListAreasAsync()
    {
        var json = await GetRawAsync("/api/clearListArea");
        return ExtractArray<ClearListArea>(json, "clearListAreas");
    }

    public async Task<string> GetClearListAreaAsync(int id)
        => await GetRawAsync($"/api/clearListArea/{id}");
}
