using Microsoft.EntityFrameworkCore;
using SetupDashboard.Models;

namespace SetupDashboard.Core.Domain;

/// <summary>
/// Dynamic subclass of DespatchContext for multi-tenant connection injection.
/// The connection string is resolved at runtime by DynamicDespatchDbContextFactory.
/// </summary>
/// <remarks>
/// READ-ONLY. Setup Dashboard reads the tenant database for validation and progress
/// counts and never writes to it: every write goes through the app that owns the data
/// (Settings, Routed Ops, Integration Manager). That is also what guarantees no staff
/// file (tucStaff) or legacy tblUser row is ever created from here.
/// </remarks>
public class DynamicDespatchDbContext(DbContextOptions<DespatchContext> options)
    : DespatchContext(options)
{
    public const string ReadOnlyMessage =
        "Setup Dashboard never writes to the tenant database directly - send the change through Settings or Routed Ops.";

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
        => throw new InvalidOperationException(ReadOnlyMessage);

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        => throw new InvalidOperationException(ReadOnlyMessage);
}
