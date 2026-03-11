using System.Text.Json;
using SetupDashboard.Models.TmsApi;

namespace SetupDashboard.Services.TmsApi;

/// <summary>
/// Base class for all TMS API services.
/// Provides shared CRUD helpers ported from the MCP server's helpers.ts.
/// </summary>
public abstract class TmsServiceBase
{
    protected readonly AdminManagerClient Client;

    protected TmsServiceBase(AdminManagerClient client)
    {
        Client = client;
    }

    // Standard read-only fields that cause 500 if sent back to the API
    private static readonly HashSet<string> StandardReadOnlyFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "created", "createdBy", "lastModified", "lastModifiedBy",
        "messageId", "success", "messages", "data",
        "startDate", "endDate", "hasVersionHistory"
    };

    /// <summary>
    /// GET endpoint, return raw JSON string for parsing.
    /// </summary>
    protected async Task<string> GetRawAsync(string endpoint)
    {
        return await Client.GetRawAsync(endpoint);
    }

    /// <summary>
    /// Parse JSON and extract an array from a possibly-wrapped response.
    /// </summary>
    protected static List<T> ExtractArray<T>(string json, params string[] possibleKeys) where T : class
    {
        var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        try
        {
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (root.ValueKind == JsonValueKind.Array)
                return DeserializeArray<T>(root, opts);

            if (root.ValueKind == JsonValueKind.Object)
            {
                foreach (var key in possibleKeys)
                {
                    if (root.TryGetProperty(key, out var prop) && prop.ValueKind == JsonValueKind.Array)
                        return DeserializeArray<T>(prop, opts);
                    // Try camelCase
                    var camel = char.ToLower(key[0]) + key[1..];
                    if (root.TryGetProperty(camel, out var camelProp) && camelProp.ValueKind == JsonValueKind.Array)
                        return DeserializeArray<T>(camelProp, opts);
                }
                // Find any array property
                foreach (var prop in root.EnumerateObject())
                    if (prop.Value.ValueKind == JsonValueKind.Array)
                        return DeserializeArray<T>(prop.Value, opts);
            }
        }
        catch { }
        return new();
    }

    private static List<T> DeserializeArray<T>(JsonElement arr, JsonSerializerOptions opts) where T : class
    {
        var result = new List<T>();
        foreach (var item in arr.EnumerateArray())
        {
            var obj = JsonSerializer.Deserialize<T>(item.GetRawText(), opts);
            if (obj != null) result.Add(obj);
        }
        return result;
    }

    /// <summary>
    /// Strip read-only fields from an API response before sending as update.
    /// </summary>
    protected static Dictionary<string, object?> FilterReadOnlyFields(
        Dictionary<string, object?> obj, params string[] extraFields)
    {
        var skip = new HashSet<string>(StandardReadOnlyFields, StringComparer.OrdinalIgnoreCase);
        foreach (var f in extraFields) skip.Add(f);

        // Auto-strip computed fields
        foreach (var key in obj.Keys.ToList())
        {
            if ((key.EndsWith("Name") || key.EndsWith("Code")) && key.Length > 4)
            {
                var suffix = key.EndsWith("Name") ? "Name" : "Code";
                var idKey = key[..^suffix.Length] + "Id";
                if (obj.ContainsKey(idKey)) skip.Add(key);
            }
        }

        return obj.Where(kv => !skip.Contains(kv.Key) && kv.Value != null)
                  .ToDictionary(kv => kv.Key, kv => kv.Value);
    }

    /// <summary>
    /// Unwrap a nested entity from GET response, parse to dictionary.
    /// </summary>
    protected static Dictionary<string, object?> UnwrapEntity(string json, string entityKey)
    {
        var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        try
        {
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (root.ValueKind == JsonValueKind.Object)
            {
                var camel = char.ToLower(entityKey[0]) + entityKey[1..];
                foreach (var key in new[] { entityKey, camel })
                {
                    if (root.TryGetProperty(key, out var nested) && nested.ValueKind == JsonValueKind.Object)
                        return JsonSerializer.Deserialize<Dictionary<string, object?>>(nested.GetRawText(), opts) ?? new();
                }
            }
            return JsonSerializer.Deserialize<Dictionary<string, object?>>(json, opts) ?? new();
        }
        catch { return new(); }
    }

    /// <summary>
    /// Merge user updates over current state.
    /// </summary>
    protected static Dictionary<string, object?> MergeUpdates(
        Dictionary<string, object?> current, Dictionary<string, object?> updates)
    {
        var result = new Dictionary<string, object?>(current);
        foreach (var (key, val) in updates)
            if (val != null) result[key] = val;
        return result;
    }

    /// <summary>
    /// Build an update dictionary from optional fields.
    /// </summary>
    protected static Dictionary<string, object?> BuildOptionalFields(params (string key, object? value)[] fields)
    {
        var result = new Dictionary<string, object?>();
        foreach (var (key, value) in fields)
            if (value != null) result[key] = value;
        return result;
    }

    /// <summary>
    /// Standard GET-merge-POST update pattern.
    /// 1. GET current entity
    /// 2. Unwrap from nested response
    /// 3. Strip read-only fields
    /// 4. Merge user changes
    /// 5. POST back
    /// </summary>
    protected async Task<string> UpdateEntityAsync(
        string endpoint, int id, string entityKey,
        Dictionary<string, object?> updates,
        params string[] extraReadOnlyFields)
    {
        var json = await GetRawAsync($"{endpoint}/{id}");
        var current = UnwrapEntity(json, entityKey);
        var filtered = FilterReadOnlyFields(current, extraReadOnlyFields);
        var merged = MergeUpdates(filtered, updates);
        return await Client.PostRawAsync($"{endpoint}/{id}", merged);
    }

    /// <summary>
    /// Bulk create with batching, retry, and delay.
    /// </summary>
    protected async Task<BulkOperationResult> BulkCreateAsync(
        string endpoint, IList<object> items, BulkOptions? options = null)
    {
        var opts = options ?? new BulkOptions();
        var result = new BulkOperationResult { Total = items.Count };

        for (var i = 0; i < items.Count; i++)
        {
            var success = false;
            string? lastError = null;

            for (var attempt = 0; attempt <= opts.RetryAttempts; attempt++)
            {
                try
                {
                    await Client.PostRawAsync(endpoint, items[i]);
                    success = true;
                    break;
                }
                catch (Exception ex)
                {
                    lastError = ex.Message;
                    if (ex.Message.Contains("400") || ex.Message.Contains("409")) break;
                    if (attempt < opts.RetryAttempts)
                        await Task.Delay(opts.RetryDelayMs * (attempt + 1));
                }
            }

            result.Results.Add(new BulkItemResult { Item = items[i], Success = success, Error = success ? null : lastError });
            if (success) result.SuccessCount++;
            opts.OnProgress?.Invoke(i + 1, items.Count);
            if (i < items.Count - 1 && opts.DelayMs > 0) await Task.Delay(opts.DelayMs);
        }

        result.FailedCount = items.Count - result.SuccessCount;
        return result;
    }

    /// <summary>
    /// Bulk delete with retry and delay.
    /// </summary>
    protected async Task<BulkOperationResult> BulkDeleteAsync(
        string endpoint, IList<int> ids, BulkOptions? options = null)
    {
        var opts = options ?? new BulkOptions();
        var result = new BulkOperationResult { Total = ids.Count };

        for (var i = 0; i < ids.Count; i++)
        {
            var success = false;
            string? lastError = null;

            for (var attempt = 0; attempt <= opts.RetryAttempts; attempt++)
            {
                try
                {
                    await Client.DeleteAsync($"{endpoint}/{ids[i]}");
                    success = true;
                    break;
                }
                catch (Exception ex)
                {
                    lastError = ex.Message;
                    if (attempt < opts.RetryAttempts) await Task.Delay(500 * (attempt + 1));
                }
            }

            result.Results.Add(new BulkItemResult { Item = new { id = ids[i] }, Success = success, Id = success ? ids[i] : null, Error = success ? null : lastError });
            if (success) result.SuccessCount++;
            opts.OnProgress?.Invoke(i + 1, ids.Count);
            if (i < ids.Count - 1 && opts.DelayMs > 0) await Task.Delay(opts.DelayMs);
        }

        result.FailedCount = ids.Count - result.SuccessCount;
        return result;
    }
}
