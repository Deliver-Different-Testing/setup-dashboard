using DeliverDifferent.AccessControl.Authorization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SetupDashboard.Core.Domain;
using Serilog;
using System.Security.Claims;

namespace SetupDashboard.Controllers;

/// <summary>
/// Hub-based login controller.
/// Validates the shared cookie from hub, caches the tenant connection string in Redis,
/// and signs in the user with updated claims.
/// Follows the same pattern as Booking HomeController:
///   ContactID claim → TucClientContact (by UcctId) → TucClient (by UcctClientId)
/// </summary>
[Route("API/[controller]")]
[RequireFeature(FeatureKeys.SetupDashboard)]
[ApiController]
public class LoginController(
    IConnectionStringManager connectionStringManager,
    IDbContextFactory<DynamicDespatchDbContext> dbFactory,
    IConfiguration configuration) : ControllerBase
{
    [HttpPost("Validate")]
    public async Task<IActionResult> Validate()
    {
        try
        {
            var contactId = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "ContactID")?.Value;
            var staffId = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "StaffID")?.Value;
            var connectionString = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
            var tenantId = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
            var tenantCode = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "TenantCode")?.Value;

            if (string.IsNullOrEmpty(tenantId))
            {
                Log.Error("TenantID is null or empty - preventing potential cross-tenant data access");
                return Unauthorized(new { message = "Valid tenant authentication required" });
            }

            if (string.IsNullOrEmpty(connectionString))
                return Unauthorized(new { message = "Authentication Failed. No Connection String." });

            // Cache the connection string with SQL credentials appended
            var credentials = Environment.GetEnvironmentVariable("SQLCredentials") ?? "";
            await connectionStringManager.SetConnectionStringAsync(
                $"{tenantId}-SetupDashboard-Connection",
                connectionString + credentials);

            // Update claims with additional user info
            var existingClaims = HttpContext.User.Claims.ToList();
            var newIdentity = new ClaimsIdentity(existingClaims, "Identity.Application");

            await HttpContext.SignInAsync(
                "Identity.Application",
                new ClaimsPrincipal(newIdentity),
                new AuthenticationProperties { IsPersistent = true });

            Log.Information("Login validated for TenantId: {TenantId}, ContactId: {ContactId}, StaffId: {StaffId}",
                tenantId, contactId, staffId);

            // Look up user's contact and client profile using the Booking pattern:
            // ContactID claim → TucClientContact (by UcctId) → TucClient (by UcctClientId)
            object clientProfile = null;
            object contactProfile = null;
            try
            {
                if (int.TryParse(contactId, out var contactIdInt))
                {
                    await using var db = dbFactory.CreateDbContext();

                    // Look up the contact by ContactID (primary key) — same as Booking's GetContact()
                    var contact = await db.TucClientContacts.AsNoTracking()
                        .Where(cc => cc.UcctId == contactIdInt)
                        .Select(cc => new
                        {
                            cc.UcctId,
                            cc.UcctFirstname,
                            cc.UcctSurname,
                            cc.UcctEmail,
                            cc.UcctDirectDial,
                            cc.UcctMobile,
                            cc.UcctJobTitle,
                            cc.UcctClientId,
                        })
                        .FirstOrDefaultAsync();

                    if (contact != null)
                    {
                        contactProfile = new
                        {
                            id = contact.UcctId,
                            firstName = contact.UcctFirstname,
                            lastName = contact.UcctSurname,
                            email = contact.UcctEmail,
                            phone = contact.UcctDirectDial ?? contact.UcctMobile,
                            title = contact.UcctJobTitle,
                        };

                        // Look up the client/company via UcctClientId — same as Booking's GetClient()
                        if (contact.UcctClientId.HasValue)
                        {
                            var client = await db.TucClients.AsNoTracking()
                                .Where(c => c.UcclId == contact.UcctClientId.Value)
                                .Select(c => new
                                {
                                    c.UcclId,
                                    c.UcclName,
                                    c.UcclLegalName,
                                    c.UcclCode,
                                    c.UcclAddress,
                                    c.UcclPostCode,
                                    c.UcclPhone,
                                    c.Ucclemail,
                                    c.UcclType,
                                    c.AddressLine3,
                                    c.AddressLine4,
                                })
                                .FirstOrDefaultAsync();

                            if (client != null)
                            {
                                clientProfile = new
                                {
                                    id = client.UcclId,
                                    name = client.UcclName,
                                    legalName = client.UcclLegalName,
                                    code = client.UcclCode,
                                    address = client.UcclAddress,
                                    postCode = client.UcclPostCode,
                                    phone = client.UcclPhone,
                                    email = client.Ucclemail,
                                    type = client.UcclType,
                                    city = client.AddressLine3,
                                    state = client.AddressLine4,
                                };
                            }
                        }
                    }

                    Log.Information("Profile loaded — ContactId: {ContactId}, ClientId: {ClientId}, Company: {Company}",
                        contactId, contact?.UcctClientId, (clientProfile as dynamic)?.name);
                }
                else
                {
                    Log.Warning("ContactID claim not found or not numeric: '{ContactId}' — profile will be empty", contactId);
                }
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Could not load profile for ContactId {ContactId} — continuing without it", contactId);
            }

            // Resolve environment key:
            // 1. If Domain env var is "local.deliverdifferent.com" → use "local"
            // 2. Otherwise match TenantCode claim against configured environments
            var domain = Environment.GetEnvironmentVariable("Domain") ?? "";
            string? envKey = null;

            Log.Information("Environment resolution — Domain: '{Domain}', TenantCode: '{TenantCode}'", domain, tenantCode);

            if (domain.Contains("local", StringComparison.OrdinalIgnoreCase))
            {
                envKey = "local";
                Log.Information("Resolved envKey='{EnvKey}' from local Domain", envKey);
            }
            else if (!string.IsNullOrEmpty(tenantCode))
            {
                var envSection = configuration.GetSection("Environments");
                // Check for exact "{tenantCode}-staging" or "{tenantCode}-prod" match
                string? stagingMatch = null;
                string? firstMatch = null;
                foreach (var env in envSection.GetChildren())
                {
                    if (env.Key.Equals("local", StringComparison.OrdinalIgnoreCase)) continue;
                    if (env.Key.StartsWith(tenantCode, StringComparison.OrdinalIgnoreCase))
                    {
                        firstMatch ??= env.Key;
                        if (env.Key.Contains("staging", StringComparison.OrdinalIgnoreCase))
                            stagingMatch = env.Key;
                    }
                }
                envKey = stagingMatch ?? firstMatch;
            }

            return Ok(new
            {
                success = true,
                tenantId,
                staffId,
                contactId,
                tenantCode,
                envKey = envKey ?? "local",
                clientProfile,
                contactProfile,
                message = "Login validated successfully"
            });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Login validation failed");
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("Status")]
    public IActionResult Status()
    {
        var isAuthenticated = HttpContext.User.Identity?.IsAuthenticated ?? false;
        var tenantId = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
        var contactId = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "ContactID")?.Value;
        var staffId = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "StaffID")?.Value;

        return Ok(new
        {
            isAuthenticated,
            tenantId,
            contactId,
            staffId
        });
    }
}
