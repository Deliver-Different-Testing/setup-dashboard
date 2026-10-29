using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Serilog;

namespace SetupDashboard.Services.TenantApps;

public sealed class AutoMateClient(
    IHttpClientFactory httpClientFactory,
    IHttpContextAccessor httpContextAccessor,
    ITenantAppUrls urls) : IAutoMateClient
{
    public const string HttpClientName = "auto-mate";
    private const string ChatPath = "/api/v1/chat/messages";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<AutoMateReply> AskAsync(string message, Guid? sessionId, CancellationToken ct = default)
    {
        var http = httpContextAccessor.HttpContext
                   ?? throw new InvalidOperationException("AutoMateClient needs the caller's request.");
        var caller = CallerContext.From(http.User);
        var cookie = TenantAppClient.ForwardableCookie(http.Request.Headers.Cookie.ToString());
        if (caller == null || cookie == null)
        {
            return AutoMateReply.Fail(AutoMateReply.SignInExpired);
        }

        var baseUrl = urls.BaseUrlForHost("csp", caller);
        if (baseUrl == null)
        {
            return AutoMateReply.Fail("Auto-Mate isn't set up on this tenant yet. Set Environments__<key>__CspUrl.");
        }

        var request = new HttpRequestMessage(HttpMethod.Post, new Uri(new Uri(baseUrl), ChatPath))
        {
            Content = new StringContent(JsonSerializer.Serialize(new { message, sessionId }, Json), Encoding.UTF8, "application/json")
        };
        request.Headers.Add("Cookie", cookie);
        request.Headers.Add("X-Requested-With", "XMLHttpRequest");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));

        HttpResponseMessage response;
        try
        {
            // Headers only: the body is the answer still being written, passed on as it arrives.
            response = await httpClientFactory.CreateClient(HttpClientName)
                .SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            Log.Warning(ex, "Auto-Mate (CSP) unreachable at {BaseUrl}", baseUrl);
            request.Dispose();
            return AutoMateReply.Fail("Auto-Mate couldn't reach the help service. Try again in a moment.");
        }

        var error = ErrorFor(response);
        if (error == null)
        {
            return AutoMateReply.Stream(request, response, await response.Content.ReadAsStreamAsync(ct));
        }

        Log.Warning("Auto-Mate (CSP) answered {Status}", (int)response.StatusCode);
        response.Dispose();
        request.Dispose();
        return AutoMateReply.Fail(error);
    }

    private static string? ErrorFor(HttpResponseMessage response)
    {
        // A redirect, or the sign-in page served as 200, means the Hub cookie has expired.
        if (TenantAppClient.IsRedirect(response.StatusCode)
            || response.IsSuccessStatusCode && response.Content.Headers.ContentType?.MediaType != "text/event-stream")
        {
            return AutoMateReply.SignInExpired;
        }

        return response.StatusCode switch
        {
            HttpStatusCode.OK => null,
            HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden =>
                "Your account can't use Auto-Mate on this tenant. Ask DFRNT to give you access to the Customer Success Platform.",
            HttpStatusCode.TooManyRequests => "You're asking too quickly. Wait a moment and try again.",
            _ => $"Auto-Mate couldn't answer just now ({(int)response.StatusCode}). Try again in a moment."
        };
    }
}

/// <summary>Either CSP's open event stream, or a plain message saying why there isn't one.</summary>
public sealed class AutoMateReply : IDisposable
{
    public const string SignInExpired = "Your sign-in has expired. Refresh the page to sign in again.";

    private HttpRequestMessage? _request;
    private HttpResponseMessage? _response;

    public bool Ok => Body != null;
    public Stream? Body { get; private init; }
    public string? Error { get; private init; }

    public static AutoMateReply Fail(string error) => new() { Error = error };

    public static AutoMateReply Stream(HttpRequestMessage request, HttpResponseMessage response, Stream body)
        => new() { _request = request, _response = response, Body = body };

    public void Dispose()
    {
        Body?.Dispose();
        _response?.Dispose();
        _request?.Dispose();
    }
}
