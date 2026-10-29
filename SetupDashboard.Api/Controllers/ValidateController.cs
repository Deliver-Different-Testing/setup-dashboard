using DeliverDifferent.AccessControl.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Serilog;
using SetupDashboard.Core.Domain;

namespace SetupDashboard.Controllers;

/// <summary>
/// "Is this already taken?" checks while typing, read from the tenant database. Advisory only:
/// the owning app enforces uniqueness on save and its message wins. When the check can't run the
/// answer is <c>unchecked</c>, never a silent "available".
/// </summary>
[Authorize]
[RequireFeature(FeatureKeys.SetupDashboard)]
[ApiController]
[Route("api/setup/validate")]
public class ValidateController(IDbContextFactory<DynamicDespatchDbContext> dbFactory) : ControllerBase
{
    /// <summary>Staff, customer contacts and partner contacts all sign in by email; Settings rejects a duplicate.</summary>
    [HttpGet("contact-email")]
    public Task<IActionResult> ContactEmail([FromQuery] string? email)
        => Check(email, db => db.TucClientContacts.AnyAsync(c => c.UcctEmail == email || c.UserName == email));

    [HttpGet("client-name")]
    public Task<IActionResult> ClientName([FromQuery] string? name)
        => Check(name, db => db.TucClients.AnyAsync(c => c.UcclName == name));

    /// <summary>Any client, active or not: the unique index doesn't care that an old one is inactive.</summary>
    [HttpGet("client-code")]
    public Task<IActionResult> ClientCode([FromQuery] string? code)
        => Check(code, db => db.TucClients.AnyAsync(c => c.UcclCode == code));

    [HttpGet("courier-email")]
    public Task<IActionResult> CourierEmail([FromQuery] string? email)
        => Check(email, async db => await db.Database.SqlQueryRaw<int>(
            "SELECT COUNT(1) AS [Value] FROM tucCourier WHERE uccrEmail = {0}", email ?? string.Empty).FirstAsync() > 0);

    [HttpGet("courier-name")]
    public Task<IActionResult> CourierName([FromQuery] string? firstName, [FromQuery] string? surname)
        => Check($"{firstName}{surname}", async db => await db.Database.SqlQueryRaw<int>(
            "SELECT COUNT(1) AS [Value] FROM tucCourier WHERE uccrName = {0} AND uccrSurname = {1}",
            firstName ?? string.Empty, surname ?? string.Empty).FirstAsync() > 0);

    [HttpGet("courier-code")]
    public Task<IActionResult> CourierCode([FromQuery] string? code)
        => Check(code, async db => await db.Database.SqlQueryRaw<int>(
            "SELECT COUNT(1) AS [Value] FROM tucCourier WHERE Code = {0}", code ?? string.Empty).FirstAsync() > 0);

    private async Task<IActionResult> Check(string? value, Func<DynamicDespatchDbContext, Task<bool>> exists)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return Ok(new { available = true });
        }

        try
        {
            await using var db = await dbFactory.CreateDbContextAsync();
            return Ok(new { available = !await exists(db) });
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Validation check could not run");
            return Ok(new { available = (bool?)null, @unchecked = true });
        }
    }
}
