using SetupDashboard.Models.TmsApi;

namespace SetupDashboard.Services.TmsApi;

/// <summary>
/// Rate Management — 23 tools from rates.ts + 6 from rates-spreadsheet.ts.
/// 
/// QUIRKS:
///   - Zone rate API ignores ?zoneNameId=X filter → client-side filtering required
///   - Standalone /api/zoneRate list returns 404 → use POST /API/rate/search composite
///   - Zone rate update uses composite /API/rate/{id} with rateType: 'zoneRate' (flat payload)
///   - Distance rate GET returns composite {zoneRate, distanceRate, flightRate, extraCharge}
/// </summary>
public class RateService : TmsServiceBase
{
    public RateService(AdminManagerClient client) : base(client) { }

    // --- Rate Cards ---

    public async Task<List<RateCard>> ListRateCardsAsync()
    {
        var json = await GetRawAsync("/api/rateCard");
        return ExtractArray<RateCard>(json, "rateCards");
    }

    public async Task<string> GetRateCardAsync(int rateCardId)
        => await GetRawAsync($"/api/rateCard/{rateCardId}");

    public async Task<string> CreateRateCardAsync(string name, int? clientId = null, int? speedId = null, int? vehicleId = null, bool? active = null)
    {
        var payload = new Dictionary<string, object?> { ["name"] = name };
        if (clientId != null) payload["clientId"] = clientId;
        if (speedId != null) payload["speedId"] = speedId;
        if (vehicleId != null) payload["vehicleId"] = vehicleId;
        if (active != null) payload["active"] = active;
        return await Client.PostRawAsync("/api/rateCard", payload);
    }

    public async Task<string> UpdateRateCardAsync(int rateCardId, string? name = null, int? clientId = null, int? speedId = null, int? vehicleId = null, bool? active = null)
    {
        var updates = BuildOptionalFields(
            ("name", name), ("clientId", clientId), ("speedId", speedId),
            ("vehicleId", vehicleId), ("active", active));
        return await UpdateEntityAsync("/api/rateCard", rateCardId, "rateCard", updates,
            "clientName", "speedName", "vehicleName", "hasVersionHistory");
    }

    public async Task DeleteRateCardAsync(int rateCardId)
        => await Client.DeleteAsync($"/api/rateCard/{rateCardId}");

    // --- Break Groups ---

    public async Task<List<BreakGroup>> ListBreakGroupsAsync(int? rateCardId = null)
    {
        var endpoint = rateCardId.HasValue ? $"/api/breakGroup?rateCardId={rateCardId}" : "/api/breakGroup";
        var json = await GetRawAsync(endpoint);
        return ExtractArray<BreakGroup>(json, "breakGroups");
    }

    public async Task<string> GetBreakGroupAsync(int breakGroupId)
        => await GetRawAsync($"/api/breakGroup/{breakGroupId}");

    public async Task<string> CreateBreakGroupAsync(string name, int rateCardId, int serviceTypeId)
        => await Client.PostRawAsync("/api/breakGroup", new { name, rateCardId, serviceTypeId });

    public async Task<string> UpdateBreakGroupAsync(int breakGroupId, string? name = null, int? rateCardId = null, int? serviceTypeId = null)
    {
        var updates = BuildOptionalFields(("name", name), ("rateCardId", rateCardId), ("serviceTypeId", serviceTypeId));
        return await UpdateEntityAsync("/api/breakGroup", breakGroupId, "breakGroup", updates);
    }

    public async Task DeleteBreakGroupAsync(int breakGroupId)
        => await Client.DeleteAsync($"/api/breakGroup/{breakGroupId}");

    // --- Breaks (weight tiers) ---

    public async Task<List<WeightBreak>> ListBreaksAsync(int? breakGroupId = null)
    {
        var endpoint = breakGroupId.HasValue ? $"/api/break?breakGroupId={breakGroupId}" : "/api/break";
        var json = await GetRawAsync(endpoint);
        return ExtractArray<WeightBreak>(json, "breaks");
    }

    public async Task<string> CreateBreakAsync(int breakGroupId, decimal minWeight, decimal maxWeight, decimal rate)
        => await Client.PostRawAsync("/api/break", new { breakGroupId, minWeight, maxWeight, rate });

    public async Task<BulkOperationResult> BulkCreateBreaksAsync(int breakGroupId, List<(decimal min, decimal max, decimal rate)> breaks)
    {
        var items = breaks.Select(b => (object)new { breakGroupId, minWeight = b.min, maxWeight = b.max, rate = b.rate }).ToList();
        return await BulkCreateAsync("/api/break", items, new BulkOptions { BatchSize = 50, DelayMs = 100 });
    }

    public async Task<string> UpdateBreakAsync(int breakId, decimal? minWeight = null, decimal? maxWeight = null, decimal? rate = null)
    {
        var updates = BuildOptionalFields(("minWeight", minWeight), ("maxWeight", maxWeight), ("rate", rate));
        return await UpdateEntityAsync("/api/break", breakId, "break", updates);
    }

    public async Task DeleteBreakAsync(int breakId)
        => await Client.DeleteAsync($"/api/break/{breakId}");

    // --- Break Types ---

    public async Task<List<BreakType>> ListBreakTypesAsync()
    {
        var json = await GetRawAsync("/api/breakType");
        return ExtractArray<BreakType>(json, "breakTypes");
    }

    // --- Zone Rates ---

    /// <summary>
    /// List zone rates. Uses composite /API/rate/search since standalone /api/zoneRate returns 404.
    /// Client-side filtering by zoneNameId since API ignores that parameter.
    /// </summary>
    public async Task<List<ZoneRate>> ListZoneRatesAsync(int? zoneNameId = null)
    {
        var json = await Client.PostRawAsync("/API/rate/search", new { searchText = "" });
        var rates = ExtractArray<ZoneRate>(json, "zoneRates");
        if (zoneNameId.HasValue)
            rates = rates.Where(r => r.ZoneNameId == zoneNameId.Value).ToList();
        return rates;
    }

    public async Task<string> CreateZoneRateAsync(int zoneNameId, int originZone, int destinationZone, int breakGroupId)
        => await Client.PostRawAsync("/api/zoneRate", new { zoneNameId, originZone, destinationZone, breakGroupId });

    public async Task<BulkOperationResult> BulkCreateZoneRatesAsync(int zoneNameId, List<(int origin, int dest, int breakGroupId)> rates)
    {
        var items = rates.Select(r => (object)new { zoneNameId, originZone = r.origin, destinationZone = r.dest, breakGroupId = r.breakGroupId }).ToList();
        return await BulkCreateAsync("/api/zoneRate", items, new BulkOptions { BatchSize = 25, DelayMs = 150 });
    }

    /// <summary>
    /// Update a zone rate. Uses composite /API/rate/{id} endpoint with rateType: 'zoneRate'.
    /// Standalone /api/zoneRate/{id} returns 404 — must use composite.
    /// </summary>
    public async Task<string> UpdateZoneRateAsync(int zoneRateId, Dictionary<string, object?> updates)
    {
        var json = await GetRawAsync($"/API/rate/{zoneRateId}");
        var current = UnwrapEntity(json, "zoneRate");
        var merged = MergeUpdates(current, updates);
        merged["rateType"] = "zoneRate"; // Required by API
        return await Client.PostRawAsync($"/API/rate/{zoneRateId}", merged);
    }

    public async Task DeleteZoneRateAsync(int zoneRateId)
        => await Client.DeleteAsync($"/api/zoneRate/{zoneRateId}");

    // --- Distance/Mileage Rates ---

    public async Task<List<DistanceRate>> ListRatesAsync(int? rateCardId = null)
    {
        var endpoint = rateCardId.HasValue ? $"/api/rate?rateCardId={rateCardId}" : "/api/rate";
        var json = await GetRawAsync(endpoint);
        return ExtractArray<DistanceRate>(json, "rates");
    }

    public async Task<string> GetRateAsync(int rateId)
        => await GetRawAsync($"/api/rate/{rateId}");

    public async Task<string> CreateRateAsync(Dictionary<string, object?> payload)
    {
        if (!payload.ContainsKey("applyBaseChargeFuel"))
            payload["applyBaseChargeFuel"] = false;
        return await Client.PostRawAsync("/api/rate", payload);
    }

    /// <summary>
    /// Update a distance rate. GET returns composite {distanceRate, zoneRate, ...}.
    /// </summary>
    public async Task<string> UpdateRateAsync(int rateId, Dictionary<string, object?> updates)
    {
        var json = await GetRawAsync($"/api/rate/{rateId}");
        var doc = System.Text.Json.JsonDocument.Parse(json);
        var root = doc.RootElement;

        // Distance rate is nested under 'distanceRate' key
        Dictionary<string, object?> current;
        if (root.TryGetProperty("distanceRate", out var dr) && dr.ValueKind == System.Text.Json.JsonValueKind.Object)
        {
            var opts = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            current = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object?>>(dr.GetRawText(), opts) ?? new();
        }
        else
        {
            throw new InvalidOperationException($"Rate {rateId} has no distanceRate data. May be a zone rate — use UpdateZoneRateAsync.");
        }

        var filtered = FilterReadOnlyFields(current, "speedName", "vehicleName", "clientName", "clientCode", "rateCardName", "weightBreakGroupName", "extraChargeName", "hasVersionHistory");
        var merged = MergeUpdates(filtered, updates);
        return await Client.PostRawAsync($"/api/rate/{rateId}", merged);
    }

    public async Task DeleteRateAsync(int rateId)
        => await Client.DeleteAsync($"/api/rate/{rateId}");

    // --- Rate Spreadsheet Version History (from rates-spreadsheet.ts) ---

    public async Task<string> ListRateSpreadsheetVersionsAsync(int rateCardId, int page = 0, int pageSize = 20)
        => await GetRawAsync($"/API/RateSpreadsheet/versions?rateCardId={rateCardId}&page={page}&pageSize={pageSize}");

    public async Task<string> GetRateSpreadsheetVersionAsync(string versionId)
        => await GetRawAsync($"/API/RateSpreadsheet/version/{versionId}");

    public async Task<string> CompareRateSpreadsheetVersionsAsync(string fromVersionId, string toVersionId)
        => await GetRawAsync($"/API/RateSpreadsheet/compare/{fromVersionId}/{toVersionId}");

    public async Task<string> GetRateSpreadsheetRollbackImpactAsync(string versionId)
        => await GetRawAsync($"/API/RateSpreadsheet/rollback/{versionId}/impact");

    public async Task<string> RollbackRateSpreadsheetAsync(string versionId)
        => await Client.PostRawAsync($"/API/RateSpreadsheet/rollback/{versionId}", new { });

    public async Task<string> ExportRateSpreadsheetAsync(int rateCardId)
        => await Client.PostRawAsync("/API/RateSpreadsheet/export", new { rateCardId, format = "xlsx" });
}
