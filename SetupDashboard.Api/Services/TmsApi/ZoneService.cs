using SetupDashboard.Models.TmsApi;

namespace SetupDashboard.Services.TmsApi;

/// <summary>
/// Zone and Zip Code Management — 20 tools from zones.ts.
/// 
/// QUIRKS:
///   - GET /api/zoneZip returns id:0 for all records → use POST /api/zoneZip/search for real IDs
///   - DELETE /api/zoneZip/{id} reports success but may not actually delete (known issue)
///   - PUT /api/zoneName/{id} returns 405 → use POST /api/zoneName/{id} instead
/// </summary>
public class ZoneService : TmsServiceBase
{
    public ZoneService(AdminManagerClient client) : base(client) { }

    // --- Zone Name CRUD ---

    /// <summary>List all zone names.</summary>
    public async Task<List<ZoneName>> ListZonesAsync()
    {
        var json = await GetRawAsync("/api/zoneName");
        return ExtractArray<ZoneName>(json, "zoneNames");
    }

    /// <summary>Get a specific zone by ID.</summary>
    public async Task<string> GetZoneAsync(int zoneId)
        => await GetRawAsync($"/api/zoneName/{zoneId}");

    /// <summary>Create a new zone name.</summary>
    public async Task<string> CreateZoneAsync(string name)
        => await Client.PostRawAsync("/api/zoneName", new { name });

    /// <summary>Update a zone (GET → merge → POST pattern, since PUT returns 405).</summary>
    public async Task<string> UpdateZoneAsync(int zoneId, string? name = null, int? locationId = null, int? zoneGroupId = null)
    {
        var json = await GetRawAsync($"/api/zoneName/{zoneId}");
        var current = UnwrapEntity(json, "zoneName");
        var payload = new Dictionary<string, object?>(current);
        if (name != null) payload["name"] = name;
        if (locationId != null) payload["locationId"] = locationId;
        if (zoneGroupId != null) payload["zoneGroupId"] = zoneGroupId;
        // Remove null/undefined values
        foreach (var key in payload.Keys.ToList())
            if (payload[key] == null) payload.Remove(key);
        return await Client.PostRawAsync($"/api/zoneName/{zoneId}", payload);
    }

    /// <summary>Delete a zone by ID.</summary>
    public async Task DeleteZoneAsync(int zoneId)
        => await Client.DeleteAsync($"/api/zoneName/{zoneId}");

    // --- Zip Code CRUD ---

    /// <summary>List zip codes, optionally filtered by zone name (client-side filter).</summary>
    public async Task<List<ZoneZip>> ListZipsAsync(int? zoneNameId = null)
    {
        var json = await GetRawAsync("/api/zoneZip");
        var zips = ExtractArray<ZoneZip>(json, "zoneZips");
        if (zoneNameId.HasValue)
            zips = zips.Where(z => z.ZoneNameId == zoneNameId.Value).ToList();
        return zips;
    }

    /// <summary>Get a single zip by ID.</summary>
    public async Task<string> GetZipAsync(int zipId)
        => await GetRawAsync($"/api/zoneZip/{zipId}");

    /// <summary>Create a single zip code entry.</summary>
    public async Task<string> CreateZipAsync(string zip, int zoneNumber, int zoneNameId, string? location = null)
        => await Client.PostRawAsync("/api/zoneZip", new { zip, zoneNumber, zoneNameId, location });

    /// <summary>Bulk create multiple zip codes.</summary>
    public async Task<BulkOperationResult> BulkCreateZipsAsync(int zoneNameId, List<CreateZoneZipRequest> zips)
    {
        var items = zips.Select(z => (object)new
        {
            zip = z.Zip, zoneNumber = z.ZoneNumber, zoneNameId, location = z.Location
        }).ToList();
        return await BulkCreateAsync("/api/zoneZip", items, new BulkOptions { BatchSize = 50, DelayMs = 100 });
    }

    /// <summary>
    /// Search zips (returns real IDs — needed for deletion).
    /// WORKAROUND: GET /api/zoneZip returns id:0 so we must use POST /api/zoneZip/search.
    /// </summary>
    public async Task<List<ZoneZip>> SearchZipsAsync(string searchText)
    {
        var json = await Client.PostRawAsync("/api/zoneZip/search", new { SearchText = searchText });
        return ExtractArray<ZoneZip>(json, "zoneZips");
    }

    /// <summary>
    /// Delete a zip by its zip string. Resolves real ID via search first.
    /// WORKAROUND: GET /api/zoneZip returns id:0 which cannot be used for deletion.
    /// </summary>
    public async Task<bool> DeleteZipByStringAsync(string zip)
    {
        var results = await SearchZipsAsync(zip);
        var exact = results.FirstOrDefault(z => z.Zip == zip);
        if (exact == null || exact.Id == 0) return false;
        await Client.DeleteAsync($"/api/zoneZip/{exact.Id}");
        return true;
    }

    /// <summary>Bulk delete zips by ID (IDs must come from SearchZips, not ListZips).</summary>
    public async Task<BulkOperationResult> BulkDeleteZipsAsync(List<int> zipIds)
        => await BulkDeleteAsync("/api/zoneZip", zipIds, new BulkOptions { DelayMs = 100 });

    /// <summary>Delete all zips in a zone (resolves real IDs via search).</summary>
    public async Task<BulkOperationResult> DeleteZipsByZoneAsync(int zoneNameId)
    {
        var allZips = await ListZipsAsync(zoneNameId);
        var zipIds = new List<int>();
        foreach (var z in allZips)
        {
            var searchResults = await SearchZipsAsync(z.Zip);
            var match = searchResults.FirstOrDefault(s => s.Zip == z.Zip && s.Id > 0);
            if (match != null) zipIds.Add(match.Id);
        }
        if (zipIds.Count == 0) return new BulkOperationResult();
        return await BulkDeleteAsync("/api/zoneZip", zipIds, new BulkOptions { DelayMs = 100 });
    }

    /// <summary>Update zone numbers for multiple zips.</summary>
    public async Task<BulkOperationResult> UpdateZoneNumbersAsync(int zoneNameId, int zoneNumber, List<int> zipIds)
    {
        var result = new BulkOperationResult { Total = zipIds.Count };
        foreach (var zipId in zipIds)
        {
            try
            {
                // Uses PUT for zone zip updates
                await Client.PostRawAsync($"/api/zoneZip/{zipId}", new { zoneNumber, zoneNameId });
                result.SuccessCount++;
                result.Results.Add(new BulkItemResult { Item = new { id = zipId }, Success = true });
            }
            catch (Exception ex)
            {
                result.FailedCount++;
                result.Results.Add(new BulkItemResult { Item = new { id = zipId }, Success = false, Error = ex.Message });
            }
        }
        return result;
    }

    // --- Locations ---

    /// <summary>List all locations (bulkRegions) for linking to zones.</summary>
    public async Task<List<BulkRegion>> ListLocationsAsync()
    {
        var json = await GetRawAsync("/api/bulkRegion");
        return ExtractArray<BulkRegion>(json, "bulkRegions", "locations");
    }

    // --- Zone Groups ---

    /// <summary>List all zone groups.</summary>
    public async Task<List<ZoneGroup>> ListZoneGroupsAsync()
    {
        var json = await GetRawAsync("/api/zoneGroup");
        return ExtractArray<ZoneGroup>(json, "zoneGroups", "groups");
    }

    /// <summary>Get a specific zone group.</summary>
    public async Task<string> GetZoneGroupAsync(int zoneGroupId)
        => await GetRawAsync($"/api/zoneGroup/{zoneGroupId}");

    /// <summary>Create a new zone group.</summary>
    public async Task<string> CreateZoneGroupAsync(string name)
        => await Client.PostRawAsync("/api/zoneGroup", new { name });

    /// <summary>Update a zone group name.</summary>
    public async Task<string> UpdateZoneGroupAsync(int zoneGroupId, string name)
        => await Client.PostRawAsync($"/api/zoneGroup/{zoneGroupId}", new { name });

    /// <summary>Delete a zone group.</summary>
    public async Task DeleteZoneGroupAsync(int zoneGroupId)
        => await Client.DeleteAsync($"/api/zoneGroup/{zoneGroupId}");
}
