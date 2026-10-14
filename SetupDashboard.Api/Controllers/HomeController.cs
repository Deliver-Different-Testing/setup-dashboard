using DeliverDifferent.AccessControl.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace SetupDashboard.Controllers;

/// <summary>
/// Serves the SPA via Razor view with [Authorize].
/// Same pattern as DespatchWeb HomeController:
/// - [Authorize] triggers cookie auth → unauthenticated users redirected to Hub
/// - Extracts claims from Hub cookie
/// - Returns Razor view that boots the React app
/// </summary>
[RequireFeature(FeatureKeys.SetupDashboard)]
public class HomeController : Controller
{
    [Authorize]
    public IActionResult Index()
    {
        try
        {
            var staffId = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "StaffID")?.Value;
            var connectionString = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
            var tenantId = HttpContext.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;

            if (string.IsNullOrEmpty(connectionString) || string.IsNullOrEmpty(tenantId))
            {
                var hubUrl = Environment.GetEnvironmentVariable("PublicPath");
                Log.Error("Connection string or tenant ID is missing from claims");
                return Redirect(hubUrl ?? "/");
            }

            // Pass user info to Razor view via ViewBag (DespatchWeb pattern)
            ViewBag.TenantId = tenantId;
            ViewBag.StaffId = staffId;

            return View();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error loading setup dashboard");
            return Redirect(Environment.GetEnvironmentVariable("PublicPath") ?? "/");
        }
    }
}
