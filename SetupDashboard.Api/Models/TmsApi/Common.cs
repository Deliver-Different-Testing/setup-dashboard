namespace SetupDashboard.Models.TmsApi;

/// <summary>
/// Generic API response wrapper matching the MCP server's ApiResponse pattern.
/// </summary>
public class TmsApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Error { get; set; }
    public int? StatusCode { get; set; }
}

/// <summary>
/// Result of a bulk operation with per-item tracking.
/// Ported from api-client.ts BulkResult.
/// </summary>
public class BulkOperationResult
{
    public int Total { get; set; }
    public int SuccessCount { get; set; }
    public int FailedCount { get; set; }
    public List<BulkItemResult> Results { get; set; } = new();
}

public class BulkItemResult
{
    public object? Item { get; set; }
    public bool Success { get; set; }
    public int? Id { get; set; }
    public string? Error { get; set; }
}

/// <summary>
/// Options for bulk operations. Ported from api-client.ts BulkOptions.
/// </summary>
public class BulkOptions
{
    public int BatchSize { get; set; } = 50;
    public int DelayMs { get; set; } = 100;
    public int RetryAttempts { get; set; } = 2;
    public int RetryDelayMs { get; set; } = 500;
    public Action<int, int>? OnProgress { get; set; }
}
