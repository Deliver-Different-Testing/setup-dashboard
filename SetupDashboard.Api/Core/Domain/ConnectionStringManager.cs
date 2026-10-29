using Microsoft.Extensions.Caching.Distributed;
using Serilog;
using SetupDashboard.Interfaces;

namespace SetupDashboard.Core.Domain;

public class ConnectionStringManager(IDistributedCache cache)
    : IConnectionStringManager
{
    private static readonly SemaphoreSlim Semaphore = new(1, 1);

    public async Task SetConnectionStringAsync(string tenantAppCacheKey, string connectionString)
    {
        if (string.IsNullOrEmpty(connectionString))
        {
            throw new ArgumentNullException(nameof(connectionString));
        }

        await Semaphore.WaitAsync();
        try
        {
            await cache.SetStringAsync(tenantAppCacheKey, connectionString); 
            Log.Information("Connection string set in distributed cache for key: {Key}", tenantAppCacheKey);
        }
        finally
        {
            Semaphore.Release();
        }
    }

    public async Task<string?> GetConnectionStringAsync(string tenantAppCacheKey)
    {
        await Semaphore.WaitAsync();
        try
        {
            var connectionString = await cache.GetStringAsync(tenantAppCacheKey);
            if (string.IsNullOrEmpty(connectionString))
            {
                Log.Warning("Connection string not found in distributed cache for key: {Key}", tenantAppCacheKey);
            }

            return connectionString;
        }
        finally
        {
            Semaphore.Release();
        }
    }
}
