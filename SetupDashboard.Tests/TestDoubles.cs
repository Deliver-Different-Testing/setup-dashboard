using System.Net;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using SetupDashboard.Services;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Tests;

/// <summary>Records every call and answers from a script. No network.</summary>
public sealed class FakeApps : ITenantAppClient
{
    public sealed record Call(TenantApp App, string Method, string Path, JsonNode? Body);

    public List<Call> Calls { get; } = [];
    public Func<Call, ApiResult> Respond { get; set; } = c => ApiResult.Success(c.App, 200, new JsonObject { ["id"] = 100 + 1 });

    public Func<Task>? BeforeWrite { get; set; }

    private int _next = 100;

    public Task<ApiResult> GetAsync(TenantApp app, string path, CancellationToken ct = default)
        => SendAsync(app, HttpMethod.Get, path, null, ct);

    public async Task<ApiResult> SendAsync(TenantApp app, HttpMethod method, string path, object? body = null, CancellationToken ct = default)
    {
        if (method != HttpMethod.Get && BeforeWrite != null)
        {
            await BeforeWrite();
        }

        var node = body == null ? null : JsonNode.Parse(JsonSerializer.Serialize(body, TenantAppClient.Json));
        var call = new Call(app, method.Method, path, node);
        Calls.Add(call);
        return Respond(call);
    }

    public int NextId() => ++_next;

    public IEnumerable<Call> Posts(string pathStart) => Calls.Where(c => c.Method == "POST" && c.Path.StartsWith(pathStart));
}

public sealed class RecordingHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
{
    public List<HttpRequestMessage> Requests { get; } = [];
    public List<string?> Bodies { get; } = [];

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Add(request);
        Bodies.Add(request.Content == null ? null : await request.Content.ReadAsStringAsync(cancellationToken));
        return respond(request);
    }
}

public sealed class SingleClientFactory(HttpMessageHandler handler) : IHttpClientFactory
{
    public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
}

public static class Make
{
    public static ClaimsPrincipal User(int tenantId = 7, int clientTypeId = 5, string tenantCode = "cheetah", string? country = "US")
        => new(new ClaimsIdentity(
        [
            new Claim("CurrentTenantID", tenantId.ToString()),
            new Claim("TenantCode", tenantCode),
            new Claim("ContactID", "42"),
            new Claim("ClientID", "9"),
            new Claim("ClientTypeId", clientTypeId.ToString()),
            new Claim("FirstName", "Dane"),
            new Claim("Surname", "Bonnici"),
            new Claim("CountryCode", country ?? "")
        ], "Identity.Application"));

    public static CallerContext Caller(int clientTypeId = 5, string country = "US")
        => CallerContext.From(User(clientTypeId: clientTypeId, country: country))!;

    /// <summary>A request to the dashboard on cheetah staging, unless another host is given.</summary>
    public static HttpContextAccessor Http(ClaimsPrincipal user, string cookie, string host = "setupdashboard.cheetah.staging.deliverdifferent.com")
    {
        var ctx = new DefaultHttpContext { User = user };
        ctx.Request.Headers.Cookie = cookie;
        ctx.Request.Host = new HostString(host);
        return new HttpContextAccessor { HttpContext = ctx };
    }

    public static IHostEnvironment Production() => new Microsoft.Extensions.Hosting.Internal.HostingEnvironment { EnvironmentName = Environments.Production };

    public static IDistributedCache Cache() => new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions()));

    public static HttpResponseMessage Json(HttpStatusCode code, string json)
        => new(code) { Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json") };
}
