namespace SetupDashboard.Services.TenantApps;

public interface ITenantAppUrls
{
    /// <summary>Base URL (scheme + host, no trailing slash) of an app on the caller's tenant, or null if unknown.</summary>
    string? BaseUrl(TenantApp app, CallerContext caller);

    /// <summary>Same rules for any app host on the tenant (adminmanager, hub...), for checklist links.</summary>
    string? BaseUrlForHost(string host, CallerContext caller);
}

/// <summary>
/// Resolves <c>https://dfrntdriveconfig.&lt;tenant&gt;[.staging].deliverdifferent.com</c> and friends.
/// </summary>
/// <remarks>
/// Precedence, first that's set wins:
/// <list type="number">
/// <item><c>TenantApps:UrlTemplate</c> (env <c>TenantApps__UrlTemplate</c>) with <c>{app}</c> and <c>{tenant}</c> (TenantCode claim).</item>
/// <item>env <c>TenantURL</c>, Hub's convention, with <c>app_name</c> as the placeholder (Hub HomeController builds tile URLs this way).</item>
/// <item><c>https://{app}.{Domain}</c> from the cookie-domain env var, which is per tenant (e.g. <c>.cheetah.deliverdifferent.com</c>).</item>
/// </list>
/// Which of these the Helm secrets actually carry is to confirm per environment.
/// </remarks>
public sealed class TenantAppUrls(IConfiguration configuration) : ITenantAppUrls
{
    public string? BaseUrl(TenantApp app, CallerContext caller)
        => BaseUrlForHost(configuration[$"TenantApps:Hosts:{app}"] ?? DefaultHost(app), caller);

    public string? BaseUrlForHost(string host, CallerContext caller)
    {
        var template = configuration["TenantApps:UrlTemplate"];
        if (!string.IsNullOrWhiteSpace(template))
        {
            if (template.Contains("{tenant}") && string.IsNullOrWhiteSpace(caller.TenantCode)) return null;
            return Trim(template.Replace("{app}", host).Replace("{tenant}", caller.TenantCode ?? ""));
        }

        var tenantUrl = configuration["TenantURL"] ?? Environment.GetEnvironmentVariable("TenantURL");
        if (!string.IsNullOrWhiteSpace(tenantUrl) && tenantUrl.Contains("app_name"))
            return Trim(tenantUrl.Replace("app_name", host));

        var domain = (configuration["Domain"] ?? Environment.GetEnvironmentVariable("Domain"))?.Trim().TrimStart('.');
        if (string.IsNullOrWhiteSpace(domain) || domain == "localhost") return null;
        var scheme = domain.Contains("local.") ? "http" : "https";
        return $"{scheme}://{host}.{domain}";
    }

    private static string DefaultHost(TenantApp app) => app switch
    {
        TenantApp.Settings => "dfrntdriveconfig",
        TenantApp.RoutedOps => "routedoperations",
        TenantApp.IntegrationManager => "integrationmanager",
        _ => throw new ArgumentOutOfRangeException(nameof(app)),
    };

    private static string Trim(string url) => url.TrimEnd('/');
}
