using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Caching.Distributed;

namespace SetupDashboard.Services.TenantApps;

public enum TenantApp
{
    Settings,
    RoutedOps,
    IntegrationManager,
}

/// <summary>
/// Calls the tenant's own apps (Settings, Routed Ops, Integration Manager) as
/// the signed-in person, by forwarding their Hub shared cookie server-side.
/// </summary>
/// <remarks>
/// WHAT EACH APP NEEDS (verified on develop, 23 Oct 2026):
/// <list type="bullet">
/// <item>The <c>.AspNet.SharedCookie</c> (plus any chunks). Same key ring and app name as Hub, so it decrypts.</item>
/// <item><c>X-Requested-With: XMLHttpRequest</c> on every POST/PUT/PATCH/DELETE, or they 400 "missing required header".</item>
/// <item>A warm tenant connection string. Settings and Routed Ops only cache it when someone loads the SPA shell
///   (<c>GET /</c>); an API call on a cold cache 500s with "Connection string is not set". So each app is
///   warmed once per tenant before the first call.</item>
/// </list>
/// The browser can't call these apps directly: Settings has no CORS.
/// No shared, cached or service login exists anywhere in this class - the old dashboard's singleton
/// Admin Manager client could send one person's cookies on another's request.
/// </remarks>
public interface ITenantAppClient
{
    Task<ApiResult> SendAsync(TenantApp app, HttpMethod method, string path, object? body = null, CancellationToken ct = default);
    Task<ApiResult> GetAsync(TenantApp app, string path, CancellationToken ct = default);

    /// <summary>
    /// Runs before every write (not reads). A push sets it to save the session, so the ids of
    /// rows already created are stored before the next record is sent.
    /// </summary>
    Func<Task>? BeforeWrite { get; set; }
}

public sealed class TenantAppClient(
    IHttpClientFactory httpClientFactory,
    IHttpContextAccessor httpContextAccessor,
    ITenantAppUrls urls,
    IDistributedCache cache,
    IConfiguration configuration,
    ILogger<TenantAppClient> logger) : ITenantAppClient
{
    public const string HttpClientName = "tenant-apps";
    private const string SharedCookie = ".AspNet.SharedCookie";

    internal static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public Func<Task>? BeforeWrite { get; set; }

    public Task<ApiResult> GetAsync(TenantApp app, string path, CancellationToken ct = default)
        => SendAsync(app, HttpMethod.Get, path, null, ct);

    public async Task<ApiResult> SendAsync(TenantApp app, HttpMethod method, string path, object? body = null, CancellationToken ct = default)
    {
        var isWrite = method != HttpMethod.Get;
        if (isWrite && BeforeWrite != null) await BeforeWrite();

        var http = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("TenantAppClient needs the caller's request.");
        var caller = CallerContext.From(http.User);
        if (caller == null) return ApiResult.AuthExpired(app);

        var cookie = ForwardableCookie(http.Request.Headers.Cookie.ToString());
        if (cookie == null) return ApiResult.AuthExpired(app);

        var baseUrl = urls.BaseUrl(app, caller);
        if (baseUrl == null)
            return ApiResult.Fail(app, 0, $"No address configured for {Label(app)} on this tenant. Set Environments__<key>__{app}Url.");

        var client = httpClientFactory.CreateClient(HttpClientName);

        var warm = await EnsureWarmAsync(client, app, caller, baseUrl, cookie, ct);
        if (!warm.Ok) return warm;

        var result = await SendOnceAsync(client, app, method, baseUrl, path, cookie, body, ct);

        // The app lost its cached tenant connection (restart, cache eviction) while our warm-up
        // flag still says it's warm. Nothing was written, so warm it again and retry once.
        if (result.Status == 500 && app != TenantApp.IntegrationManager
            && result.Messages.Any(m => m.Contains("Connection string", StringComparison.OrdinalIgnoreCase)))
        {
            await cache.RemoveAsync(WarmKey(caller, app), ct);
            warm = await EnsureWarmAsync(client, app, caller, baseUrl, cookie, ct);
            if (!warm.Ok) return warm;
            result = await SendOnceAsync(client, app, method, baseUrl, path, cookie, body, ct);
        }
        return result;
    }

    private async Task<ApiResult> SendOnceAsync(HttpClient client, TenantApp app, HttpMethod method, string baseUrl, string path,
        string cookie, object? body, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(method, new Uri(new Uri(baseUrl), path));
        request.Headers.Add("Cookie", cookie);
        request.Headers.Add("X-Requested-With", "XMLHttpRequest");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (body != null)
            request.Content = new StringContent(JsonSerializer.Serialize(body, Json), Encoding.UTF8, "application/json");

        var isWrite = method != HttpMethod.Get;
        try
        {
            using var response = await client.SendAsync(request, ct);
            return await ApiResult.FromResponseAsync(app, response, ct);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            // A write that timed out may well have been saved - the app just didn't answer in time.
            return isWrite ? ApiResult.NoAnswer(app) : ApiResult.Fail(app, 0, $"{Label(app)} did not answer in time.");
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "{App} call {Method} {Path} failed", app, method, path);
            return isWrite && ex.HttpRequestError == HttpRequestError.ResponseEnded
                ? ApiResult.NoAnswer(app)
                : ApiResult.Fail(app, 0, $"Could not reach {Label(app)}: {ex.Message}");
        }
    }

    private static string WarmKey(CallerContext caller, TenantApp app) => $"setup-warm:{caller.TenantId}:{app}";

    /// <summary>
    /// Loads the app's SPA shell once per tenant so it caches the tenant's DB connection.
    /// Remembered in the distributed cache for less than the apps' own 8 h sliding window.
    /// </summary>
    private async Task<ApiResult> EnsureWarmAsync(HttpClient client, TenantApp app, CallerContext caller, string baseUrl, string cookie, CancellationToken ct)
    {
        if (app == TenantApp.IntegrationManager) return ApiResult.Success(app, 200, null); // fetches from Hub on a miss

        var key = WarmKey(caller, app);
        if (await cache.GetStringAsync(key, ct) != null) return ApiResult.Success(app, 200, null);

        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(new Uri(baseUrl), "/"));
        request.Headers.Add("Cookie", cookie);
        try
        {
            using var response = await client.SendAsync(request, ct);
            if (IsRedirect(response.StatusCode)) return ApiResult.AuthExpired(app);
            if (response.StatusCode == HttpStatusCode.Forbidden)
                return ApiResult.Fail(app, 403, $"Your account can't open {Label(app)} on this tenant.");
            if (!response.IsSuccessStatusCode)
                return ApiResult.Fail(app, (int)response.StatusCode, $"{Label(app)} didn't load ({(int)response.StatusCode}).");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            return ApiResult.Fail(app, 0, $"Could not reach {Label(app)}: {ex.Message}");
        }

        var minutes = configuration.GetValue("TenantApps:WarmUpMinutes", 360);
        await cache.SetStringAsync(key, "1", new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(minutes) }, ct);
        return ApiResult.Success(app, 200, null);
    }

    /// <summary>Only the Hub shared cookie (and its ASP.NET chunks) leave this app - not session or analytics cookies.</summary>
    internal static string? ForwardableCookie(string cookieHeader)
    {
        if (string.IsNullOrWhiteSpace(cookieHeader)) return null;
        var parts = cookieHeader.Split(';', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Where(p => p.StartsWith(SharedCookie + "=", StringComparison.Ordinal)
                        || p.StartsWith(SharedCookie + "C", StringComparison.Ordinal))
            .ToList();
        return parts.Count == 0 ? null : string.Join("; ", parts);
    }

    internal static bool IsRedirect(HttpStatusCode s) => (int)s is >= 300 and < 400;

    internal static string Label(TenantApp app) => app switch
    {
        TenantApp.Settings => "Settings",
        TenantApp.RoutedOps => "Routed Operations",
        TenantApp.IntegrationManager => "Integration Manager",
        _ => app.ToString(),
    };
}

/// <summary>
/// Outcome of one call. The target app's own validation messages come back verbatim, so the
/// dashboard never restates (and can't drift from) another app's rules.
/// </summary>
public sealed class ApiResult
{
    public TenantApp App { get; init; }
    public bool Ok { get; init; }
    public int Status { get; init; }
    public JsonNode? Body { get; init; }
    public List<string> Messages { get; init; } = new();
    public bool SignInExpired { get; init; }

    /// <summary>A write that got no answer: the app may have saved it, so it must not simply be sent again.</summary>
    public bool MayHaveSaved { get; init; }

    /// <summary>The created row's id, from whichever envelope the app uses.</summary>
    public int? Id => FindId(Body);

    public static ApiResult Success(TenantApp app, int status, JsonNode? body, List<string>? messages = null)
        => new() { App = app, Ok = true, Status = status, Body = body, Messages = messages ?? new() };

    public static ApiResult Fail(TenantApp app, int status, string message)
        => new() { App = app, Ok = false, Status = status, Messages = [message] };

    public static ApiResult NoAnswer(TenantApp app)
        => new()
        {
            App = app, Ok = false, Status = 0, MayHaveSaved = true,
            Messages = [$"{TenantAppClient.Label(app)} didn't answer in time, so this may have been saved. Check {TenantAppClient.Label(app)}, then choose Send again if it isn't there."],
        };

    public static ApiResult AuthExpired(TenantApp app)
        => new() { App = app, Ok = false, Status = 401, SignInExpired = true, Messages = ["Your sign-in has expired. Refresh the page and sign in again."] };

    public static async Task<ApiResult> FromResponseAsync(TenantApp app, HttpResponseMessage response, CancellationToken ct)
    {
        var status = (int)response.StatusCode;
        if (TenantAppClient.IsRedirect(response.StatusCode) || response.StatusCode == HttpStatusCode.Unauthorized)
            return AuthExpired(app);

        var text = response.Content == null ? "" : await response.Content.ReadAsStringAsync(ct);
        JsonNode? body = null;
        if (!string.IsNullOrWhiteSpace(text))
        {
            try { body = JsonNode.Parse(text); }
            catch (JsonException) { body = null; }
        }

        var messages = ExtractMessages(body);

        if (response.IsSuccessStatusCode)
        {
            // Settings sometimes answers 200 with { success: false } - treat as a failure.
            if (body is JsonObject o && o["success"] is JsonValue sv && sv.TryGetValue<bool>(out var ok) && !ok)
                return new ApiResult { App = app, Ok = false, Status = status, Body = body, Messages = messages.Count > 0 ? messages : ["Rejected without a reason."] };
            return Success(app, status, body, messages);
        }

        if (messages.Count == 0)
        {
            messages.Add(response.StatusCode switch
            {
                HttpStatusCode.Forbidden => $"Your role can't do this in {TenantAppClient.Label(app)}.",
                HttpStatusCode.NotFound => $"{TenantAppClient.Label(app)} doesn't have that record or page.",
                HttpStatusCode.Conflict => "That already exists.",
                _ => string.IsNullOrWhiteSpace(text) || text.Length > 300
                    ? $"{TenantAppClient.Label(app)} returned {status}."
                    : text.Trim(),
            });
        }
        return new ApiResult { App = app, Ok = false, Status = status, Body = body, Messages = messages };
    }

    internal static List<string> ExtractMessages(JsonNode? body)
    {
        var list = new List<string>();
        if (body is not JsonObject o) return list;

        if (o["messages"] is JsonArray arr)
            foreach (var m in arr)
            {
                var text = m is JsonObject mo ? mo["message"]?.GetValue<string>() : m?.GetValue<string>();
                if (!string.IsNullOrWhiteSpace(text)) list.Add(text);
            }

        foreach (var k in new[] { "message", "error", "title" })
            if (o[k] is JsonValue v && v.TryGetValue<string>(out var s) && !string.IsNullOrWhiteSpace(s) && !list.Contains(s))
            {
                // ProblemDetails "title" is generic; only use it when nothing better exists.
                if (k == "title" && (list.Count > 0 || o["errors"] != null)) continue;
                list.Add(s);
            }

        if (o["errors"] is JsonObject errs) // [ApiController] ProblemDetails
            foreach (var (field, val) in errs)
                if (val is JsonArray fa)
                    foreach (var e in fa)
                        if (e?.GetValue<string>() is { } es) list.Add($"{field}: {es}");

        return list;
    }

    internal static int? FindId(JsonNode? body)
    {
        static int? Read(JsonNode? n) => n is JsonValue v && v.TryGetValue<int>(out var i) && i > 0 ? i : null;

        if (body is not JsonObject o) return null;
        foreach (var k in new[] { "id", "contactRoleId", "scheduleId", "bundleId", "polygonId" })
            if (Read(o[k]) is { } id) return id;
        if (o["response"] is JsonObject r)
            foreach (var k in new[] { "id", "scheduleId", "bundleId", "polygonId" })
                if (Read(r[k]) is { } id) return id;
        if (o["data"] is JsonObject d && Read(d["id"]) is { } did) return did;
        return null;
    }
}
