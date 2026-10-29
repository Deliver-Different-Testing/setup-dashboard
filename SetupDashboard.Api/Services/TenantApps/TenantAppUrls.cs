namespace SetupDashboard.Services.TenantApps;

public interface ITenantAppUrls
{
    /// <summary>Base URL (scheme + host, no trailing slash) of an app on the caller's tenant, or null if unknown.</summary>
    string? BaseUrl(TenantApp app, CallerContext caller);

    /// <summary>Same rules for any app on the <c>TenantApps:Hosts</c> list (AdminManager, Hub, Csp...), by name.</summary>
    string? BaseUrlForHost(string app, CallerContext caller);
}

/// <summary>
/// An app's address is the address the dashboard was opened on with its first label swapped for the app's
/// host name from <c>TenantApps:Hosts</c>: <c>setupdashboard.cheetah.staging.deliverdifferent.com</c> becomes
/// <c>dfrntdriveconfig.cheetah.staging.deliverdifferent.com</c>. Same tenant and environment, nothing to set per deployment.
/// </summary>
/// <remarks>
/// The Host header is the browser's and these calls carry the person's Hub cookie, so a forged host must never
/// become a target: only hosts under <c>TenantApps:RootDomain</c> and under this pod's cookie <c>Domain</c> are
/// swapped, and http with <c>TenantApps:LocalPorts</c> (each app's own port) is for Development only, never
/// chosen from the host name.
/// </remarks>
public sealed class TenantAppUrls(IConfiguration configuration, IHttpContextAccessor httpContextAccessor, IHostEnvironment environment)
    : ITenantAppUrls
{
    private const string DefaultRootDomain = "deliverdifferent.com";

    public string? BaseUrl(TenantApp app, CallerContext caller) => BaseUrlForHost(app.ToString(), caller);

    public string? BaseUrlForHost(string app, CallerContext caller)
    {
        var entry = configuration.GetSection("TenantApps:Hosts").GetChildren()
            .FirstOrDefault(e => e.Key.Equals(app, StringComparison.OrdinalIgnoreCase));
        if (string.IsNullOrWhiteSpace(entry?.Value) || TenantDomain() is not { } domain)
        {
            return null;
        }

        var host = $"{entry.Value.Trim().ToLowerInvariant()}.{domain}";
        if (!environment.IsDevelopment())
        {
            return $"https://{host}";
        }

        var port = configuration[$"TenantApps:LocalPorts:{entry.Key}"];
        return string.IsNullOrWhiteSpace(port) ? $"http://{host}" : $"http://{host}:{port.Trim()}";
    }

    /// <summary>
    /// This request's host without its first label (<c>cheetah.staging.deliverdifferent.com</c>), or null when
    /// it isn't <c>&lt;app&gt;.&lt;something&gt;.&lt;root domain&gt;</c> (localhost, an IP, a forged host).
    /// </summary>
    private string? TenantDomain()
    {
        var host = httpContextAccessor.HttpContext?.Request.Host.Host?.Trim().TrimEnd('.').ToLowerInvariant();
        if (string.IsNullOrEmpty(host))
        {
            return null;
        }

        var root = Clean(configuration["TenantApps:RootDomain"] ?? DefaultRootDomain);
        if (!Under(host, root))
        {
            return null;
        }

        // The app label, then at least the tenant (or "local") label, then the root domain.
        var labels = host.Split('.');
        if (labels.Length < root.Split('.').Length + 2)
        {
            return null;
        }

        var domain = string.Join('.', labels.Skip(1));
        // A pod is one tenant: its cookie Domain (e.g. .cheetah.staging.deliverdifferent.com) keeps calls on that tenant.
        var cookieDomain = Clean(configuration["Domain"] ?? Environment.GetEnvironmentVariable("Domain") ?? string.Empty);
        if (cookieDomain.Length > 0 && cookieDomain != "localhost" && domain != cookieDomain && !Under(domain, cookieDomain))
        {
            return null;
        }

        // A local host outside Development would be http to whatever "local" resolves to; refuse it.
        return !environment.IsDevelopment() && domain.Split('.').Contains("local") ? null : domain;
    }

    private static bool Under(string host, string domain) => host.EndsWith("." + domain, StringComparison.Ordinal);

    private static string Clean(string domain) => domain.Trim().Trim('.').ToLowerInvariant();
}
