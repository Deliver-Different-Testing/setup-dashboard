using System.Net;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Tests;

public class TenantAppClientTests
{
    private static IConfiguration Config(string? template = "https://{app}.{tenant}.staging.deliverdifferent.com")
        => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["TenantApps:UrlTemplate"] = template,
        }).Build();

    private static (TenantAppClient Client, RecordingHandler Handler) Build(Func<HttpRequestMessage, HttpResponseMessage> respond,
        string cookie = ".AspNet.SharedCookie=abc; hub_session=zzz; _ga=1")
    {
        var handler = new RecordingHandler(respond);
        var config = Config();
        var client = new TenantAppClient(new SingleClientFactory(handler), Make.Http(Make.User(), cookie),
            new TenantAppUrls(config), Make.Cache(), config, NullLogger<TenantAppClient>.Instance);
        return (client, handler);
    }

    [Fact]
    public async Task Writes_carry_the_csrf_header_and_only_the_hub_cookie()
    {
        var (client, handler) = Build(_ => Make.Json(HttpStatusCode.OK, "{\"id\":5}"));

        var res = await client.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/admin/roles", new { name = "Cheetah Admin" });

        Assert.True(res.Ok);
        var post = handler.Requests.Last();
        Assert.Equal("https://dfrntdriveconfig.cheetah.staging.deliverdifferent.com/api/admin/roles", post.RequestUri!.ToString());
        Assert.Equal("XMLHttpRequest", post.Headers.GetValues("X-Requested-With").Single());
        Assert.Equal(".AspNet.SharedCookie=abc", post.Headers.GetValues("Cookie").Single());
        Assert.Contains("\"name\":\"Cheetah Admin\"", handler.Bodies.Last());
    }

    [Fact]
    public async Task Each_app_is_warmed_once_before_its_first_call()
    {
        var (client, handler) = Build(_ => Make.Json(HttpStatusCode.OK, "{}"));

        await client.GetAsync(TenantApp.Settings, "/api/v1/tenant/lookups/speeds");
        await client.GetAsync(TenantApp.Settings, "/api/v1/tenant/lookups/zone-names");
        await client.GetAsync(TenantApp.RoutedOps, "/api/schedules/lookups");

        var paths = handler.Requests.Select(r => r.RequestUri!.Host + r.RequestUri.AbsolutePath).ToList();
        Assert.Equal(
        [
            "dfrntdriveconfig.cheetah.staging.deliverdifferent.com/",
            "dfrntdriveconfig.cheetah.staging.deliverdifferent.com/api/v1/tenant/lookups/speeds",
            "dfrntdriveconfig.cheetah.staging.deliverdifferent.com/api/v1/tenant/lookups/zone-names",
            "routedoperations.cheetah.staging.deliverdifferent.com/",
            "routedoperations.cheetah.staging.deliverdifferent.com/api/schedules/lookups",
        ], paths);
    }

    [Fact]
    public async Task A_redirect_means_the_sign_in_expired()
    {
        var (client, _) = Build(_ => new HttpResponseMessage(HttpStatusCode.Redirect));

        var res = await client.GetAsync(TenantApp.Settings, "/api/admin/roles");

        Assert.False(res.Ok);
        Assert.True(res.SignInExpired);
    }

    [Fact]
    public async Task No_hub_cookie_means_no_call_at_all()
    {
        var (client, handler) = Build(_ => Make.Json(HttpStatusCode.OK, "{}"), cookie: "hub_session=zzz");

        var res = await client.GetAsync(TenantApp.Settings, "/api/admin/roles");

        Assert.True(res.SignInExpired);
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task Settings_validation_messages_come_back_verbatim()
    {
        var (client, _) = Build(r => r.RequestUri!.AbsolutePath == "/"
            ? Make.Json(HttpStatusCode.OK, "{}")
            : Make.Json(HttpStatusCode.BadRequest, "{\"success\":false,\"messages\":[{\"message\":\"A valid invoice schedule is required.\"}]}"));

        var res = await client.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/v1/tenant/clients", new { });

        Assert.False(res.Ok);
        Assert.Equal(["A valid invoice schedule is required."], res.Messages);
    }

    [Fact]
    public async Task A_write_that_times_out_may_have_saved_and_says_so()
    {
        var (client, _) = Build(r => r.RequestUri!.AbsolutePath == "/"
            ? Make.Json(HttpStatusCode.OK, "{}")
            : throw new TaskCanceledException("timeout"));

        var res = await client.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/v1/tenant/clients", new { });

        Assert.False(res.Ok);
        Assert.True(res.MayHaveSaved);
    }

    [Fact]
    public async Task A_read_that_times_out_is_a_plain_failure()
    {
        var (client, _) = Build(r => r.RequestUri!.AbsolutePath == "/"
            ? Make.Json(HttpStatusCode.OK, "{}")
            : throw new TaskCanceledException("timeout"));

        var res = await client.GetAsync(TenantApp.Settings, "/api/admin/roles");

        Assert.False(res.Ok);
        Assert.False(res.MayHaveSaved);
    }

    [Fact]
    public async Task A_cold_connection_string_is_rewarmed_and_the_call_retried_once()
    {
        var calls = 0;
        var (client, handler) = Build(r => r.RequestUri!.AbsolutePath == "/"
            ? Make.Json(HttpStatusCode.OK, "{}")
            : ++calls == 1
                ? Make.Json(HttpStatusCode.InternalServerError, "{\"message\":\"Connection string is not set\"}")
                : Make.Json(HttpStatusCode.OK, "{\"id\":5}"));

        var res = await client.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/admin/roles", new { name = "x" });

        Assert.True(res.Ok);
        Assert.Equal(["/", "/api/admin/roles", "/", "/api/admin/roles"], handler.Requests.Select(r => r.RequestUri!.AbsolutePath));
    }

    [Fact]
    public async Task Writes_run_the_checkpoint_first_and_reads_do_not()
    {
        var (client, _) = Build(_ => Make.Json(HttpStatusCode.OK, "{}"));
        var checkpoints = 0;
        client.BeforeWrite = () => { checkpoints++; return Task.CompletedTask; };

        await client.GetAsync(TenantApp.Settings, "/api/admin/roles");
        await client.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/admin/roles", new { });

        Assert.Equal(1, checkpoints);
    }

    [Theory]
    [InlineData("{\"id\":12}", 12)]
    [InlineData("{\"contactRoleId\":9,\"name\":\"x\"}", 9)]
    [InlineData("{\"response\":{\"scheduleId\":31}}", 31)]
    [InlineData("{\"success\":true,\"id\":null}", null)]
    public void Ids_are_read_from_each_apps_envelope(string json, int? expected)
        => Assert.Equal(expected, ApiResult.FindId(System.Text.Json.Nodes.JsonNode.Parse(json)));

    [Fact]
    public void Chunked_shared_cookies_are_forwarded_and_nothing_else()
        => Assert.Equal(".AspNet.SharedCookie=chunks-2; .AspNet.SharedCookieC1=a; .AspNet.SharedCookieC2=b",
            TenantAppClient.ForwardableCookie("_ga=1; .AspNet.SharedCookie=chunks-2; .AspNet.SharedCookieC1=a; hub_session=x; .AspNet.SharedCookieC2=b"));

    [Fact]
    public void Url_falls_back_to_hub_style_tenant_url()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["TenantURL"] = "https://app_name.cheetah.deliverdifferent.com/",
        }).Build();
        Assert.Equal("https://routedoperations.cheetah.deliverdifferent.com",
            new TenantAppUrls(config).BaseUrl(TenantApp.RoutedOps, Make.Caller()));
    }
}
