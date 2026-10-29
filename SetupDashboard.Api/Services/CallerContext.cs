using System.Security.Claims;

namespace SetupDashboard.Services;

/// <summary>
/// Who is calling, from the Hub shared cookie. The tenant ALWAYS comes from
/// here - never from a request body or a picker (the old dashboard let the
/// browser choose which environment's Admin Manager received writes).
/// </summary>
public sealed record CallerContext(
    int TenantId,
    string? TenantCode,
    int? ContactId,
    int? ClientId,
    int ClientTypeId,
    string? Name,
    string? CountryCode)
{
    private const int DfAdminClientType = 5;
    public const int TenantClientType = 4;

    public bool IsDfAdmin => ClientTypeId == DfAdminClientType;
    public bool IsUsTenant => string.Equals(CountryCode, "US", StringComparison.OrdinalIgnoreCase);

    public static CallerContext? From(ClaimsPrincipal user)
    {
        if (user.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        if (!int.TryParse(user.FindFirst("CurrentTenantID")?.Value, out var tenantId) || tenantId <= 0)
        {
            return null;
        }

        return new CallerContext(
            tenantId,
            user.FindFirst("TenantCode")?.Value,
            ParseInt(user.FindFirst("ContactID")?.Value),
            ParseInt(user.FindFirst("ClientID")?.Value),
            ParseInt(user.FindFirst("ClientTypeId")?.Value) ?? 0,
            JoinName(user.FindFirst("FirstName")?.Value, user.FindFirst("Surname")?.Value) ?? user.Identity?.Name,
            user.FindFirst("CountryCode")?.Value);
    }

    private static int? ParseInt(string? v) => int.TryParse(v, out var i) && i > 0 ? i : null;

    private static string? JoinName(string? first, string? last)
    {
        var n = $"{first} {last}".Trim();
        return n.Length == 0 ? null : n;
    }
}
