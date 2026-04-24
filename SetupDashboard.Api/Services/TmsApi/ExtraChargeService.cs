using SetupDashboard.Models.TmsApi;

namespace SetupDashboard.Services.TmsApi;

/// <summary>
/// Extra Charge and Accessorial Charge Management.
/// 5 tools from extra-charges.ts + 7 tools from accessorial-charges.ts.
/// 
/// QUIRKS:
///   - Extra charges use /API/rate composite endpoint (capital API)
///   - List uses POST /API/rate/search with searchText
///   - Create/update requires rateType: 'extraCharge'
///   - Delete uses /API/rate/{id}/extraCharge path
///   - Accessorial charges use dedicated /API/accessorialCharge controller
///   - Accessorial charge groups are read-only via rate composite (write returns 500)
/// </summary>
public class ExtraChargeService : TmsServiceBase
{
    public ExtraChargeService(AdminManagerClient client) : base(client) { }

    // --- Extra Charges (Legacy) ---

    public async Task<List<ExtraCharge>> ListExtraChargesAsync()
    {
        var json = await Client.PostRawAsync("/API/rate/search", new { searchText = "" });
        return ExtractArray<ExtraCharge>(json, "extraCharges");
    }

    public async Task<string> GetExtraChargeAsync(int extraChargeId)
        => await GetRawAsync($"/API/rate/{extraChargeId}");

    public async Task<string> CreateExtraChargeAsync(Dictionary<string, object?> fields)
    {
        fields["rateType"] = "extraCharge";
        if (!fields.ContainsKey("active")) fields["active"] = true;
        return await Client.PostRawAsync("/API/rate", fields);
    }

    /// <summary>
    /// Update extra charge. Fetches current, merges, posts back with rateType: 'extraCharge'.
    /// </summary>
    public async Task<string> UpdateExtraChargeAsync(int extraChargeId, Dictionary<string, object?> updates)
    {
        var json = await GetRawAsync($"/API/rate/{extraChargeId}");
        var doc = System.Text.Json.JsonDocument.Parse(json);
        var root = doc.RootElement;
        var opts = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        // Extra charge may be nested under 'extraCharge' or 'rate'
        Dictionary<string, object?> current;
        if (root.TryGetProperty("extraCharge", out var ec) && ec.ValueKind == System.Text.Json.JsonValueKind.Object)
            current = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object?>>(ec.GetRawText(), opts) ?? new();
        else if (root.TryGetProperty("rate", out var r) && r.ValueKind == System.Text.Json.JsonValueKind.Object)
            current = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object?>>(r.GetRawText(), opts) ?? new();
        else
            current = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object?>>(json, opts) ?? new();

        var filtered = FilterReadOnlyFields(current);
        var merged = MergeUpdates(filtered, updates);
        merged["rateType"] = "extraCharge";
        return await Client.PostRawAsync($"/API/rate/{extraChargeId}", merged);
    }

    /// <summary>Delete extra charge. Uses /API/rate/{id}/extraCharge path.</summary>
    public async Task DeleteExtraChargeAsync(int extraChargeId)
        => await Client.DeleteAsync($"/API/rate/{extraChargeId}/extraCharge");

    // --- Accessorial Charges (New System) ---

    public async Task<List<AccessorialCharge>> SearchAccessorialChargesAsync(string searchText = "")
    {
        var json = await Client.PostRawAsync("/API/accessorialCharge/search", new { searchText });
        return ExtractArray<AccessorialCharge>(json, "accessorialCharges");
    }

    public async Task<string> GetAccessorialChargeAsync(int id)
        => await GetRawAsync($"/API/accessorialCharge/{id}");

    public async Task<string> CreateAccessorialChargeAsync(Dictionary<string, object?> fields)
    {
        if (!fields.ContainsKey("active")) fields["active"] = true;
        if (!fields.ContainsKey("requiresQuote")) fields["requiresQuote"] = false;
        if (!fields.ContainsKey("calculationOrder")) fields["calculationOrder"] = 0;
        return await Client.PostRawAsync("/API/accessorialCharge", fields);
    }

    public async Task<string> UpdateAccessorialChargeAsync(int id, Dictionary<string, object?> updates)
        => await UpdateEntityAsync("/API/accessorialCharge", id, "accessorialCharge", updates);

    public async Task DeleteAccessorialChargeAsync(int id)
        => await Client.DeleteAsync($"/API/accessorialCharge/{id}");

    // --- Accessorial Charge Groups (Read-Only via rate composite) ---

    public async Task<List<AccessorialChargeGroup>> ListAccessorialChargeGroupsAsync(string searchText = "")
    {
        var json = await Client.PostRawAsync("/API/rate/search", new { searchText });
        return ExtractArray<AccessorialChargeGroup>(json, "accessorialChargeGroups");
    }

    public async Task<string> GetAccessorialChargeGroupAsync(int id)
        => await GetRawAsync($"/API/rate/{id}");
}
