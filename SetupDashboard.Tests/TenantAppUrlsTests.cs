using Microsoft.Extensions.Configuration;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Tests;

/// <summary>
/// The other apps' addresses come from the deployment's <c>Environments__&lt;key&gt;__*</c> settings
/// (e.g. <c>Environments__local__HubLoginUrl</c>) - nothing is derived from the request.
/// </summary>
public class TenantAppUrlsTests
{
    private static IConfiguration Config(Dictionary<string, string?> values)
        => new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    private static Dictionary<string, string?> Env(string key, string host) => new()
    {
        [$"Environments:{key}:Name"] = key,
        [$"Environments:{key}:BaseUrl"] = $"https://adminmanager.{host}",
        [$"Environments:{key}:HubUrl"] = $"https://hub.{host}",
        [$"Environments:{key}:HubLoginUrl"] = $"https://hub.{host}/Account/login",
        [$"Environments:{key}:DispatchUrl"] = $"https://despatch.{host}",
        [$"Environments:{key}:ApiUrl"] = $"https://api.{host}",
        [$"Environments:{key}:SettingsUrl"] = $"https://dfrntdriveconfig.{host}/",
        [$"Environments:{key}:RoutedOpsUrl"] = $"https://routedoperations.{host}",
        [$"Environments:{key}:IntegrationManagerUrl"] = $"https://integrationmanager.{host}",
    };

    [Theory]
    [InlineData(TenantApp.Settings, "https://dfrntdriveconfig.cheetah.staging.deliverdifferent.com")]
    [InlineData(TenantApp.RoutedOps, "https://routedoperations.cheetah.staging.deliverdifferent.com")]
    [InlineData(TenantApp.IntegrationManager, "https://integrationmanager.cheetah.staging.deliverdifferent.com")]
    public void A_single_environment_is_the_one_used(TenantApp app, string expected)
        => Assert.Equal(expected, new TenantAppUrls(Config(Env("cheetah-staging", "cheetah.staging.deliverdifferent.com"))).BaseUrl(app, Make.Caller()));

    [Theory]
    [InlineData("adminmanager", "https://adminmanager.cheetah.staging.deliverdifferent.com")]
    [InlineData("hub", "https://hub.cheetah.staging.deliverdifferent.com")]
    [InlineData("dfrntdriveconfig", "https://dfrntdriveconfig.cheetah.staging.deliverdifferent.com")]
    [InlineData("integrationmanager", "https://integrationmanager.cheetah.staging.deliverdifferent.com")]
    public void Checklist_links_use_the_same_environment(string host, string expected)
        => Assert.Equal(expected, new TenantAppUrls(Config(Env("cheetah-staging", "cheetah.staging.deliverdifferent.com"))).BaseUrlForHost(host, Make.Caller()));

    [Fact]
    public void An_unknown_host_has_no_link()
        => Assert.Null(new TenantAppUrls(Config(Env("local", "local.deliverdifferent.com"))).BaseUrlForHost("somethingelse", Make.Caller()));

    [Fact]
    public void Without_an_environment_there_is_no_address()
        => Assert.Null(new TenantAppUrls(Config(new Dictionary<string, string?>())).BaseUrl(TenantApp.Settings, Make.Caller()));

    [Fact]
    public void An_environment_without_that_app_has_no_address()
    {
        var values = Env("local", "local.deliverdifferent.com");
        values.Remove("Environments:local:RoutedOpsUrl");
        Assert.Null(new TenantAppUrls(Config(values)).BaseUrl(TenantApp.RoutedOps, Make.Caller()));
    }

    [Theory]
    [InlineData("cheetah.staging.deliverdifferent.com", "https://dfrntdriveconfig.cheetah.staging.deliverdifferent.com")]
    [InlineData("cheetah.deliverdifferent.com", "https://dfrntdriveconfig.cheetah.deliverdifferent.com")]
    [InlineData("local.deliverdifferent.com", "https://dfrntdriveconfig.local.deliverdifferent.com")]
    public void With_several_environments_the_tenant_and_domain_pick_one(string domain, string expected)
    {
        var values = Env("cheetah-staging", "cheetah.staging.deliverdifferent.com")
            .Concat(Env("cheetah-prod", "cheetah.deliverdifferent.com"))
            .Concat(Env("local", "local.deliverdifferent.com"))
            .ToDictionary(kv => kv.Key, kv => kv.Value);
        values["Domain"] = domain;

        Assert.Equal(expected, new TenantAppUrls(Config(values)).BaseUrl(TenantApp.Settings, Make.Caller()));
    }

    [Fact]
    public void With_several_environments_and_no_match_there_is_no_address()
    {
        var values = Env("medical-staging", "medical.staging.deliverdifferent.com")
            .Concat(Env("medical-prod", "medical.deliverdifferent.com"))
            .ToDictionary(kv => kv.Key, kv => kv.Value);
        values["Domain"] = "cheetah.deliverdifferent.com";

        Assert.Null(new TenantAppUrls(Config(values)).BaseUrl(TenantApp.Settings, Make.Caller()));
    }
}
