using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Caching.Memory;
using Serilog;

namespace SetupDashboard.Services;

public interface ITenantLogoService
{
    Task<string?> GetLogoUrlAsync(string? tenantCode);
}

public class TenantLogoService(IAmazonS3 s3Client, IMemoryCache cache) : ITenantLogoService
{
    private const string LogoKey = "tenantLogo.png";
    private const int CacheDurationMinutes = 30;
    private const string FallbackLogo = "/setup-dashboard/logos/DFRNT_HorizLogo_RGB.png";

    // Tenant code → local logo filename (copied from Hub wwwroot/images/)
    private static readonly Dictionary<string, string> LocalLogos = new(StringComparer.OrdinalIgnoreCase)
    {
        ["local"] = "DFRNT_HorizLogo_RGB.png",
        ["crossroadscourier"] = "crossroadscourierLogo.png",
        ["otgcargo"] = "otgcargoLogo.png",
        ["otg"] = "otgcargoLogo.png",
        ["reverse"] = "reverseLogo.png",
        ["deliverdifferent"] = "deliverDifferentLogo.png",
        ["dfrnt"] = "DFRNT_HorizLogo_RGB.png",
        ["medical"] = "DFRNT_HorizLogo_RGB.png"
    };

    /// <summary>
    /// Tenant logo for the header. The bucket comes from env <c>S3BucketBulk</c>, the same
    /// variable Hub's LogoController reads; it was derived from a browser-chosen
    /// "environment" before the rewrite.
    /// </summary>
    public async Task<string?> GetLogoUrlAsync(string? tenantCode)
    {
        var code = tenantCode ?? string.Empty;
        var cacheKey = $"tenant_logo_url_{code}";
        if (cache.TryGetValue(cacheKey, out string? cachedUrl))
        {
            return cachedUrl;
        }

        if (LocalLogos.TryGetValue(code, out var localFile))
        {
            var url = $"/setup-dashboard/logos/{localFile}";
            cache.Set(cacheKey, url, TimeSpan.FromMinutes(CacheDurationMinutes));
            return url;
        }

        var bucketName = Environment.GetEnvironmentVariable("S3BucketBulk");
        if (!string.IsNullOrWhiteSpace(bucketName))
        {
            try
            {
                var logoUrl = await s3Client.GetPreSignedURLAsync(new GetPreSignedUrlRequest
                {
                    BucketName = bucketName,
                    Key = LogoKey,
                    Verb = HttpVerb.GET,
                    Expires = DateTime.UtcNow.AddHours(1)
                });
                cache.Set(cacheKey, logoUrl, TimeSpan.FromMinutes(CacheDurationMinutes));
                return logoUrl;
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "S3 logo not available for tenant {TenantCode}", code);
            }
        }

        cache.Set(cacheKey, FallbackLogo, TimeSpan.FromMinutes(5));
        return FallbackLogo;
    }
}
