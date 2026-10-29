using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Tests;

/// <summary>
/// The other apps' addresses come from the address the dashboard itself was opened on, so a
/// tenant needs no URL settings: setup-dashboard.cheetah.staging... -> dfrntdriveconfig.cheetah.staging...
/// </summary>
public class TenantAppUrlsTests
{
    private static IConfiguration Config(Dictionary<string, string?>? values = null)
        => new ConfigurationBuilder().AddInMemoryCollection(values ?? new()).Build();

    private static IHttpContextAccessor Request(string host)
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Scheme = "https";
        ctx.Request.Host = new HostString(host);
        return new HttpContextAccessor { HttpContext = ctx };
    }

    [Theory]
    [InlineData("setup-dashboard.cheetah.staging.deliverdifferent.com", TenantApp.Settings, "https://dfrntdriveconfig.cheetah.staging.deliverdifferent.com")]
    [InlineData("setup-dashboard.urgent.deliverdifferent.com", TenantApp.RoutedOps, "https://routedoperations.urgent.deliverdifferent.com")]
    [InlineData("SETUP-DASHBOARD.Cheetah.Staging.DeliverDifferent.com:443", TenantApp.IntegrationManager, "https://integrationmanager.cheetah.staging.deliverdifferent.com")]
    public void Built_from_the_address_the_dashboard_was_opened_on(string host, TenantApp app, string expected)
        => Assert.Equal(expected, new TenantAppUrls(Config(), Request(host)).BaseUrl(app, Make.Caller()));

    [Fact]
    public void Checklist_links_to_any_app_use_the_same_rule()
        => Assert.Equal("https://adminmanager.cheetah.staging.deliverdifferent.com",
            new TenantAppUrls(Config(), Request("setup-dashboard.cheetah.staging.deliverdifferent.com")).BaseUrlForHost("adminmanager", Make.Caller()));

    [Theory]
    [InlineData("setup-dashboard.cheetah.staging.evil.com")]       // forged Host header: the caller's cookie would go there
    [InlineData("deliverdifferent.com.evil.com")]
    [InlineData("setup-dashboard.evildeliverdifferent.com")]
    [InlineData("deliverdifferent.com")]                             // no app label to replace
    [InlineData("localhost:5173")]
    [InlineData("10.0.0.12")]
    public void Never_builds_an_address_outside_deliverdifferent_com(string host)
        => Assert.Null(new TenantAppUrls(Config(), Request(host)).BaseUrl(TenantApp.Settings, Make.Caller()));

    [Fact]
    public void An_explicit_template_still_wins()
    {
        var urls = new TenantAppUrls(Config(new() { ["TenantApps:UrlTemplate"] = "https://{app}.{tenant}.example.test" }),
            Request("setup-dashboard.cheetah.staging.deliverdifferent.com"));
        Assert.Equal("https://dfrntdriveconfig.cheetah.example.test", urls.BaseUrl(TenantApp.Settings, Make.Caller()));
    }

    [Fact]
    public void Without_a_usable_request_address_it_falls_back_to_TenantURL()
    {
        var urls = new TenantAppUrls(Config(new() { ["TenantURL"] = "https://app_name.cheetah.deliverdifferent.com/" }), Request("localhost:5173"));
        Assert.Equal("https://routedoperations.cheetah.deliverdifferent.com", urls.BaseUrl(TenantApp.RoutedOps, Make.Caller()));
    }
}
