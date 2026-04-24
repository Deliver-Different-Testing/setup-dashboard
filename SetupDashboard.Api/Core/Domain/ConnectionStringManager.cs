using Microsoft.Extensions.Caching.Distributed;

namespace SetupDashboard.Core.Domain;

public interface IConnectionStringManager
{
    Task SetConnectionStringAsync(string tenantAppCacheKey, string connectionString);
    Task<string?> GetConnectionStringAsync(string tenantAppCacheKey);
}

public class ConnectionStringManager(IDistributedCache cache, ILogger<ConnectionStringManager> logger)
    : IConnectionStringManager
{
    private static readonly SemaphoreSlim _semaphore = new(1, 1);

    public async Task SetConnectionStringAsync(string tenantAppCacheKey, string connectionString)
    {
        if (string.IsNullOrEmpty(connectionString))
            throw new ArgumentNullException(nameof(connectionString));

        await _semaphore.WaitAsync();
        try
        {
            await cache.SetStringAsync(tenantAppCacheKey, connectionString);
            logger.LogInformation("Connection string set in distributed cache for key: {Key}", tenantAppCacheKey);
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public async Task<string?> GetConnectionStringAsync(string tenantAppCacheKey)
    {
        await _semaphore.WaitAsync();
        try
        {
            var connectionString = await cache.GetStringAsync(tenantAppCacheKey);
            if (string.IsNullOrEmpty(connectionString))
                logger.LogWarning("Connection string not found in distributed cache for key: {Key}", tenantAppCacheKey);
            return connectionString;
        }
        finally
        {
            _semaphore.Release();
        }
    }
}
