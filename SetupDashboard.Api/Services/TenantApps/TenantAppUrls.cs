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
/// Precedence, first that applies wins:
/// <list type="number">
/// <item><c>TenantApps:UrlTemplate</c> (env <c>TenantApps__UrlTemplate</c>) with <c>{app}</c> and <c>{tenant}</c> (TenantCode claim) - an override, not needed normally.</item>
/// <item>The address the dashboard was opened on, with its first label swapped for the app:
///   <c>setup-dashboard.cheetah.staging.deliverdifferent.com</c> -> <c>dfrntdriveconfig.cheetah.staging.deliverdifferent.com</c>.
///   Same tenant and environment as the person is already on, with nothing to configure.</item>
/// <item>env <c>TenantURL</c>, Hub's convention, with <c>app_name</c> as the placeholder (Hub HomeController builds tile URLs this way).</item>
/// <item><c>https://{app}.{Domain}</c> from the cookie-domain env var, which is per tenant (e.g. <c>.cheetah.deliverdifferent.com</c>).</item>
/// </list>
/// </remarks>
public sealed class TenantAppUrls(IConfiguration configuration, IHttpContextAccessor? httpContextAccessor = null) : ITenantAppUrls
{
    /// <summary>
    /// The only domain a request-derived address may be under. The Host header comes from the browser
    /// and the call carries the person's Hub cookie, so a forged host must never become a target.
    /// </summary>
    private const string DefaultRootDomain = "deliverdifferent.com";

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

        if (FromRequest(host) is { } fromRequest) return fromRequest;

        var tenantUrl = configuration["TenantURL"] ?? Environment.GetEnvironmentVariable("TenantURL");
        if (!string.IsNullOrWhiteSpace(tenantUrl) && tenantUrl.Contains("app_name"))
            return Trim(tenantUrl.Replace("app_name", host));

        var domain = (configuration["Domain"] ?? Environment.GetEnvironmentVariable("Domain"))?.Trim().TrimStart('.');
        if (string.IsNullOrWhiteSpace(domain) || domain == "localhost") return null;
        var scheme = domain.Contains("local.") ? "http" : "https";
        return $"{scheme}://{host}.{domain}";
    }

    /// <summary>
    /// Swaps the first label of this request's host for <paramref name="app"/>, or null when the host
    /// isn't <c>&lt;label&gt;.&lt;something&gt;.deliverdifferent.com</c> (localhost, an IP, a forged host).
    /// </summary>
    private string? FromRequest(string app)
    {
        var host = httpContextAccessor?.HttpContext?.Request.Host.Host?.Trim().TrimEnd('.').ToLowerInvariant();
        if (string.IsNullOrEmpty(host)) return null;

        var root = (configuration["TenantApps:RootDomain"] ?? DefaultRootDomain).Trim().Trim('.').ToLowerInvariant();
        if (!host.EndsWith("." + root, StringComparison.Ordinal)) return null;

        var labels = host.Split('.');
        // The app label, then at least the tenant label, then the root domain.
        if (labels.Length < root.Split('.').Length + 2) return null;

        var baseDomain = string.Join('.', labels.Skip(1));
        var scheme = baseDomain.StartsWith("local.", StringComparison.Ordinal) || baseDomain.Contains(".local.") ? "http" : "https";
        return $"{scheme}://{app.ToLowerInvariant()}.{baseDomain}";
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
