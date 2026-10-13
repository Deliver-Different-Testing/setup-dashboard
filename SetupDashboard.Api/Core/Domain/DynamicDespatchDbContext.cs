using Microsoft.EntityFrameworkCore;
using SetupDashboard.Models;

namespace SetupDashboard.Core.Domain;

/// <summary>
/// Dynamic subclass of DespatchContext for multi-tenant connection injection.
/// The connection string is resolved at runtime by DynamicDespatchDbContextFactory.
/// </summary>
public class DynamicDespatchDbContext(DbContextOptions<DespatchContext> options)
    : DespatchContext(options)
{
}
