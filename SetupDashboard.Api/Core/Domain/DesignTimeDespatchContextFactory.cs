using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using SetupDashboard.Models;

namespace SetupDashboard.Core.Domain;

/// <summary>
/// Design-time factory for EF Core tools (dotnet ef migrations, scaffolding, etc.)
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<DespatchContext>
{
    public DespatchContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("SQLHealthCheckConnection")
            ?? "Server=(localdb)\\mssqllocaldb;Database=DesignTimeDb;Trusted_Connection=True;";

        var optionsBuilder = new DbContextOptionsBuilder<DespatchContext>();
        optionsBuilder.UseSqlServer(connectionString);

        return new DespatchContext(optionsBuilder.Options);
    }
}
