using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Hosting.Internal;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Tests;

/// <summary>
/// The other apps' addresses are the address the dashboard was opened on with the app name swapped:
/// <c>setupdashboard.cheetah.staging.deliverdifferent.com</c> -> <c>dfrntdriveconfig.cheetah.staging.deliverdifferent.com</c>.
/// </summary>
public class TenantAppUrlsTests
{
    private static readonly Dictionary<string, string?> Apps = new()
    {
        ["TenantApps:Hosts:Settings"] = "dfrntdriveconfig",
        ["TenantApps:Hosts:RoutedOps"] = "routedoperations",
        ["TenantApps:Hosts:IntegrationManager"] = "integrationmanager",
        ["TenantApps:Hosts:AdminManager"] = "adminmanager",
        ["TenantApps:Hosts:Hub"] = "hub",
        ["TenantApps:Hosts:Csp"] = "dfrntcrm"
    };

    private static TenantAppUrls Urls(string? host, Dictionary<string, string?>? extra = null, string environment = "Production")
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(Apps.Concat(extra ?? [])).Build();
        var context = new DefaultHttpContext();
        if (host != null)
        {
            context.Request.Host = HostString.FromUriComponent(host);
        }

        return new TenantAppUrls(config, new HttpContextAccessor { HttpContext = context }, new HostingEnvironment { EnvironmentName = environment });
    }

    [Theory]
    [InlineData(TenantApp.Settings, "https://dfrntdriveconfig.cheetah.staging.deliverdifferent.com")]
    [InlineData(TenantApp.RoutedOps, "https://routedoperations.cheetah.staging.deliverdifferent.com")]
    [InlineData(TenantApp.IntegrationManager, "https://integrationmanager.cheetah.staging.deliverdifferent.com")]
    public void Swaps_the_app_name_in_the_address_the_dashboard_is_on(TenantApp app, string expected)
        => Assert.Equal(expected, Urls("setupdashboard.cheetah.staging.deliverdifferent.com").BaseUrl(app, Make.Caller()));

    [Fact]
    public void Works_the_same_on_production()
        => Assert.Equal("https://dfrntdriveconfig.cheetah.deliverdifferent.com",
            Urls("setupdashboard.cheetah.deliverdifferent.com").BaseUrl(TenantApp.Settings, Make.Caller()));

    [Theory]
    [InlineData("adminmanager", "https://adminmanager.cheetah.staging.deliverdifferent.com")]
    [InlineData("hub", "https://hub.cheetah.staging.deliverdifferent.com")]
    [InlineData("csp", "https://dfrntcrm.cheetah.staging.deliverdifferent.com")]
    public void Other_apps_are_looked_up_by_name(string app, string expected)
        => Assert.Equal(expected, Urls("setupdashboard.cheetah.staging.deliverdifferent.com").BaseUrlForHost(app, Make.Caller()));

    [Fact]
    public void An_app_not_on_the_list_has_no_address()
        => Assert.Null(Urls("setupdashboard.cheetah.staging.deliverdifferent.com").BaseUrlForHost("somethingelse", Make.Caller()));

    [Theory]
    [InlineData("setupdashboard.evil.example")]
    [InlineData("deliverdifferent.com.evil.example")]
    [InlineData("evildeliverdifferent.com")]
    [InlineData("deliverdifferent.com")]
    [InlineData("localhost:7200")]
    [InlineData("10.0.0.5")]
    [InlineData(null)]
    public void Only_hosts_under_the_root_domain_are_used(string? host)
        => Assert.Null(Urls(host).BaseUrl(TenantApp.Settings, Make.Caller()));

    [Fact]
    public void Local_runs_use_http_and_the_apps_local_port()
    {
        var urls = Urls("setupdashboard.local.deliverdifferent.com:5200", new Dictionary<string, string?> { ["TenantApps:LocalPorts:Settings"] = "62371" }, Environments.Development);
        Assert.Equal("http://dfrntdriveconfig.local.deliverdifferent.com:62371", urls.BaseUrl(TenantApp.Settings, Make.Caller()));
    }

    [Fact]
    public void A_local_app_without_a_port_drops_the_dashboards_port()
        => Assert.Equal("http://routedoperations.local.deliverdifferent.com",
            Urls("setupdashboard.local.deliverdifferent.com:5200", environment: Environments.Development).BaseUrl(TenantApp.RoutedOps, Make.Caller()));

    [Fact]
    public void Outside_development_a_local_host_is_refused()
        => Assert.Null(Urls("setupdashboard.local.deliverdifferent.com", new Dictionary<string, string?> { ["TenantApps:LocalPorts:Settings"] = "62371" })
            .BaseUrl(TenantApp.Settings, Make.Caller()));

    [Theory]
    [InlineData(".cheetah.staging.deliverdifferent.com")]
    [InlineData("cheetah.staging.deliverdifferent.com")]
    [InlineData(".deliverdifferent.com")]
    public void A_host_under_the_pods_cookie_domain_is_used(string domain)
        => Assert.Equal("https://dfrntdriveconfig.cheetah.staging.deliverdifferent.com",
            Urls("setupdashboard.cheetah.staging.deliverdifferent.com", new Dictionary<string, string?> { ["Domain"] = domain }).BaseUrl(TenantApp.Settings, Make.Caller()));

    [Fact]
    public void Another_tenants_host_is_refused_when_the_pod_has_a_tenant_domain()
        => Assert.Null(Urls("setupdashboard.medical.staging.deliverdifferent.com", new Dictionary<string, string?> { ["Domain"] = ".cheetah.staging.deliverdifferent.com" })
            .BaseUrl(TenantApp.Settings, Make.Caller()));
}
