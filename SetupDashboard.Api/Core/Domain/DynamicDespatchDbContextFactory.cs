using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Serilog;
using SetupDashboard.Models;

namespace SetupDashboard.Core.Domain;

public class DynamicDespatchDbContextFactory(
    IOptions<DbContextOptions<DespatchContext>> options,
    IConnectionStringManager connectionStringManager,
    IHttpContextAccessor contextAccessor)
    : IDbContextFactory<DynamicDespatchDbContext>
{
    private readonly DbContextOptions<DespatchContext> _options = options.Value;

    public DynamicDespatchDbContext CreateDbContext()
    {
        var tenantId = contextAccessor.HttpContext?.User.Claims
            .FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;

        Log.Information("CreateDbContext called - TenantId: '{TenantId}', IsAuthenticated: {IsAuthenticated}",
            tenantId ?? "NULL",
            contextAccessor.HttpContext?.User?.Identity?.IsAuthenticated ?? false);

        if (string.IsNullOrEmpty(tenantId))
        {
            Log.Error("TenantID is null or empty - preventing potential cross-tenant data access");
            throw new UnauthorizedAccessException("Valid tenant authentication required. Please login via Hub first.");
        }

        var connectionStringKey = $"{tenantId}-SetupDashboard-Connection";
        Log.Information("Looking up connection string with key: '{ConnectionStringKey}'", connectionStringKey);
        var connectionString = connectionStringManager.GetConnectionStringAsync(connectionStringKey)
            .GetAwaiter().GetResult();

        if (string.IsNullOrEmpty(connectionString))
        {
            Log.Error("Connection string is not set for key: '{ConnectionStringKey}'", connectionStringKey);
            throw new InvalidOperationException($"Connection string is not set for key: {connectionStringKey}");
        }

        var optionsBuilder = new DbContextOptionsBuilder<DespatchContext>(_options);
        optionsBuilder.UseSqlServer(connectionString);

        Log.Information("Creating DynamicDespatchDbContext with connection string");
        return new DynamicDespatchDbContext(optionsBuilder.Options);
    }
}
