using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Caching.Memory;
using Serilog;

namespace SetupDashboard.Services;

public interface ITenantLogoService
{
    Task<string?> GetLogoUrlAsync(string environment, string tenantCode = "");
}

public class TenantLogoService : ITenantLogoService
{
    private readonly IAmazonS3 _s3Client;
    private readonly IMemoryCache _cache;
    private const string BucketPrefix = "urgent-couriers-bulk-upload-storage-";
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
        ["medical"] = "DFRNT_HorizLogo_RGB.png",
    };

    public TenantLogoService(IAmazonS3 s3Client, IMemoryCache cache)
    {
        _s3Client = s3Client;
        _cache = cache;
    }

    public async Task<string?> GetLogoUrlAsync(string environment, string tenantCode = "")
    {
        if (string.IsNullOrEmpty(environment))
            return FallbackLogo;

        // Use tenant code if provided, otherwise extract from environment
        var code = !string.IsNullOrEmpty(tenantCode) ? tenantCode : environment.Split('-')[0];
        var cacheKey = $"tenant_logo_url_{code}_{environment}";
        if (_cache.TryGetValue(cacheKey, out string? cachedUrl))
            return cachedUrl;
        // 1. Try local logo (works in dev and prod)
        if (LocalLogos.TryGetValue(code, out var localFile))
        {
            var url = $"/setup-dashboard/logos/{localFile}";
            _cache.Set(cacheKey, url, TimeSpan.FromMinutes(CacheDurationMinutes));
            Log.Information("Using local logo for {Environment}: {File}", environment, localFile);
            return url;
        }

        // 2. Try S3 (production tenants without local logo)
        try
        {
            var bucketName = $"{BucketPrefix}{environment}";
            var logoUrl = await _s3Client.GetPreSignedURLAsync(new GetPreSignedUrlRequest
            {
                BucketName = bucketName,
                Key = LogoKey,
                Verb = HttpVerb.GET,
                Expires = DateTime.UtcNow.AddHours(1)
            });

            _cache.Set(cacheKey, logoUrl, TimeSpan.FromMinutes(CacheDurationMinutes));
            return logoUrl;
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "S3 logo not available for {Environment}", environment);
        }

        // 3. Fallback
        _cache.Set(cacheKey, FallbackLogo, TimeSpan.FromMinutes(5));
        return FallbackLogo;
    }
}
