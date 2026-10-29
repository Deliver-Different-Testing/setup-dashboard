using SetupDashboard.Models;

namespace SetupDashboard.Services.TenantApps;

public interface ITenantAppUrls
{
    /// <summary>Base URL (scheme + host, no trailing slash) of an app on the caller's tenant, or null if unknown.</summary>
    string? BaseUrl(TenantApp app, CallerContext caller);

    /// <summary>Same rules for any app host on the tenant (adminmanager, hub...), for checklist links.</summary>
    string? BaseUrlForHost(string host, CallerContext caller);
}

/// <summary>
/// App addresses from the deployment's <c>Environments__&lt;key&gt;__*</c> settings, e.g.
/// <c>Environments__local__SettingsUrl</c> and <c>Environments__local__HubLoginUrl</c>.
/// </summary>
/// <remarks>
/// Each pod is one tenant in one environment, so a deployment normally sets exactly one
/// <c>Environments</c> entry and that one is used. With several, the entry is matched as the
/// pre-rewrite LoginController did: <c>local</c> when the <c>Domain</c> env var is local, otherwise
/// <c>&lt;TenantCode&gt;-staging</c> or <c>&lt;TenantCode&gt;-prod</c> by whether <c>Domain</c> is a staging one.
/// No address is ever built from the request, so a forged Host header can't redirect calls that
/// carry the person's Hub cookie.
/// </remarks>
public sealed class TenantAppUrls(IConfiguration configuration) : ITenantAppUrls
{
    public string? BaseUrl(TenantApp app, CallerContext caller)
    {
        var env = Resolve(caller);
        if (env == null)
        {
            return null;
        }

        return Clean(app switch
        {
            TenantApp.Settings => env.SettingsUrl,
            TenantApp.RoutedOps => env.RoutedOpsUrl,
            TenantApp.IntegrationManager => env.IntegrationManagerUrl,
            _ => throw new ArgumentOutOfRangeException(nameof(app))
        });
    }

    public string? BaseUrlForHost(string host, CallerContext caller)
    {
        var env = Resolve(caller);
        if (env == null)
        {
            return null;
        }

        return Clean(host.ToLowerInvariant() switch
        {
            "adminmanager" => env.BaseUrl,
            "hub" => env.HubUrl,
            "despatch" or "despatchweb" => env.DispatchUrl,
            "api" => env.ApiUrl,
            "dfrntdriveconfig" => env.SettingsUrl,
            "routedoperations" => env.RoutedOpsUrl,
            "integrationmanager" => env.IntegrationManagerUrl,
            _ => null
        });
    }

    private DfrntEnvironment? Resolve(CallerContext caller)
    {
        var entries = configuration.GetSection("Environments").GetChildren().ToList();
        if (entries.Count == 0)
        {
            return null;
        }

        var entry = entries.Count == 1 ? entries[0] : Match(entries, caller.TenantCode);
        return entry?.Get<DfrntEnvironment>();
    }

    private IConfigurationSection? Match(List<IConfigurationSection> entries, string? tenantCode)
    {
        var domain = configuration["Domain"] ?? Environment.GetEnvironmentVariable("Domain") ?? string.Empty;
        if (domain.Contains("local", StringComparison.OrdinalIgnoreCase))
        {
            return entries.FirstOrDefault(e => e.Key.Equals("local", StringComparison.OrdinalIgnoreCase));
        }

        if (string.IsNullOrWhiteSpace(tenantCode))
        {
            return null;
        }

        var suffix = domain.Contains("staging", StringComparison.OrdinalIgnoreCase) ? "-staging" : "-prod";
        return entries.FirstOrDefault(e => e.Key.Equals(tenantCode + suffix, StringComparison.OrdinalIgnoreCase));
    }

    private static string? Clean(string? url) => string.IsNullOrWhiteSpace(url) ? null : url.Trim().TrimEnd('/');
}
