using SetupDashboard.Models.TmsApi;

namespace SetupDashboard.Services.TmsApi;

/// <summary>
/// Job Management — 12 tools from jobs.ts.
/// NOTE: Uses dispatch subdomain (not admin manager).
/// Financial data (revenue/cost) is not available via API.
/// 
/// QUIRKS:
///   - Job list/detail/actions use {dispatchUrl}/job endpoints
///   - Job creation uses {apiUrl}/api/Jobs (REST API, requires Bearer token, NOT cookie auth)
///   - splitJob endpoint returns HTTP 500 on all tenants (known bug)
/// </summary>
public class JobService : TmsServiceBase
{
    public JobService(AdminManagerClient client) : base(client) { }

    private string DispatchUrl => Client.Environment.DispatchUrl;

    /// <summary>List jobs from Dispatch with optional filters.</summary>
    public async Task<string> ListJobsAsync(string? startDate = null, string? endDate = null, int? clientId = null, string? status = null, int limit = 100)
    {
        var qs = $"page=0&pageSize={limit}&order=booked&orderDirection=desc";
        if (startDate != null) qs += $"&startDate={startDate}";
        if (endDate != null) qs += $"&endDate={endDate}";
        return await GetRawAsync($"{DispatchUrl}/job?{qs}");
    }

    /// <summary>Get job details by ID.</summary>
    public async Task<string> GetJobAsync(int jobId)
        => await GetRawAsync($"{DispatchUrl}/job/Detail?jobId={jobId}");

    /// <summary>Get job summary statistics.</summary>
    public async Task<string> GetJobStatsAsync()
        => await GetRawAsync($"{DispatchUrl}/job?page=0&pageSize=1000");

    /// <summary>Void (cancel) a job.</summary>
    public async Task<string> VoidJobAsync(int jobId)
        => await Client.PostRawAsync($"{DispatchUrl}/job/Void", new { jobId });

    /// <summary>Assign a courier to jobs (must be New status).</summary>
    public async Task<string> AllocateJobAsync(int courierId, List<int> jobIds)
        => await Client.PostRawAsync($"{DispatchUrl}/job/Allocate", new { courierId, jobIds });

    /// <summary>Reassign a different courier to already-dispatched jobs.</summary>
    public async Task<string> ReallocateJobAsync(int courierId, List<int> jobIds)
        => await Client.PostRawAsync($"{DispatchUrl}/job/ReAllocate", new { courierId, jobIds });

    /// <summary>Restore voided jobs.</summary>
    public async Task<string> RestoreJobsAsync(List<int> jobIds)
        => await Client.PostRawAsync($"{DispatchUrl}/job/RestoreJobs", new { jobIds });

    /// <summary>Add an event/note to a job. Events do NOT change job status.</summary>
    public async Task<string> AddJobEventAsync(int jobId, int eventTypeId, string? note = null)
    {
        var payload = new Dictionary<string, object?> { ["jobId"] = jobId, ["eventTypeId"] = eventTypeId };
        if (note != null) payload["note"] = note;
        return await Client.PostRawAsync($"{DispatchUrl}/job/addEvent", payload);
    }

    /// <summary>Split a dispatched job. KNOWN BUG: Returns HTTP 500 on all tenants.</summary>
    public async Task<string> SplitJobAsync(int jobId)
        => await Client.PostRawAsync($"{DispatchUrl}/job/splitJob", new { jobId });

    /// <summary>
    /// Create a job via the REST API. Requires Bearer token auth (not cookie auth).
    /// Two-step: 1) POST /api/Rates for quoteId, 2) POST /api/Jobs to book.
    /// NOTE: This method requires the API URL and bearer token to be configured separately.
    /// </summary>
    public async Task<string> CreateJobAsync(CreateJobRequest request)
    {
        // This is a simplified placeholder. Full implementation requires:
        // 1. Bearer token auth (separate from cookie auth)
        // 2. Two-step flow: /api/Rates then /api/Jobs
        // The MCP server loads bearer token from .env file.
        throw new NotImplementedException(
            "Job creation requires Bearer token auth via the REST API ({apiUrl}/api/Jobs), " +
            "which is separate from cookie auth. Configure API key and use the REST API endpoint directly.");
    }
}
