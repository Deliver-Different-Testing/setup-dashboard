using Amazon;
using Amazon.Runtime;
using Amazon.Runtime.CredentialManagement;
using Amazon.S3;
using DeliverDifferent.AccessControl;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.StackExchangeRedis;
using Serilog;
using SetupDashboard;
using SetupDashboard.Core.Domain;
using SetupDashboard.Services;
using StackExchange.Redis;

// ── Serilog bootstrap ──
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // ── Serilog ──
    builder.Host.UseSerilog((ctx, lc) => lc
        .ReadFrom.Configuration(ctx.Configuration)
        .WriteTo.Console());

    // ── Controllers + Views (Razor views for SPA shell, same as DespatchWeb) ──
    builder.Services.AddControllersWithViews()
        .AddJsonOptions(opts =>
        {
            opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
            opts.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
        });

    builder.Services.AddHttpContextAccessor();

    // ── CORS ──
    var corsOrigins = builder.Configuration.GetSection("CorsOrigins").Get<string[]>()
        ?? new[] { "http://localhost:5173" };
    builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(policy =>
        {
            policy.WithOrigins(corsOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        });
    });

    // ── Data Protection (shared cookie decryption) ──
    var domain = Environment.GetEnvironmentVariable("Domain") ?? "localhost";

    if (builder.Environment.IsDevelopment())
    {
        var keyDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "DeliverDifferent", "DataProtection-Keys");

        if (!Directory.Exists(keyDirectory))
            Directory.CreateDirectory(keyDirectory);

        builder.Services.AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(keyDirectory))
            .SetApplicationName("DeliverDifferent");
    }
    else
    {
        builder.Services.AddDataProtection()
            .PersistKeysToAWSSystemsManager("/Hub/DataProtection")
            .SetApplicationName("DeliverDifferent");
    }

    // ── Authorization ──
    builder.Services.AddAuthorization();

    // ── Authentication (shared cookie from Hub) ──
    builder.Services.AddAuthentication("Identity.Application")
        .AddCookie("Identity.Application", options =>
        {
            options.Cookie.Name = ".AspNet.SharedCookie";
            options.ExpireTimeSpan = TimeSpan.FromMinutes(20);
            options.SlidingExpiration = true;
            options.AccessDeniedPath = "/Forbidden/";
            options.Events = new CookieAuthenticationEvents
            {
                OnRedirectToLogin = context =>
                {
                    context.HttpContext.Response.Redirect(
                        Environment.GetEnvironmentVariable("PublicPath") ?? "");
                    return Task.CompletedTask;
                },
                // A plain 403 instead of a redirect to AccessDeniedPath. No
                // /Forbidden/ route exists, so the redirect would land on the
                // SPA fallback (HomeController), be forbidden again, and loop.
                OnRedirectToAccessDenied = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "text/plain";
                    return context.Response.WriteAsync(
                        "Setup Dashboard is not enabled for your account. Ask a DFRNT administrator.");
                }
            };
            options.Cookie.HttpOnly = true;
            options.Cookie.Domain = domain;
        });

    // ── Redis distributed cache ──
    var redisConfig = Environment.GetEnvironmentVariable("RedisConfig");
    if (!string.IsNullOrEmpty(redisConfig))
    {
        var redisConfigurationOptions = ConfigurationOptions.Parse(redisConfig);
        builder.Services.AddStackExchangeRedisCache(redisCacheConfig =>
        {
            redisCacheConfig.ConfigurationOptions = redisConfigurationOptions;
        });

        try
        {
            var redis = ConnectionMultiplexer.Connect(redisConfigurationOptions);
            Log.Information("Redis connection successful");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Redis connection failed — falling back to in-memory distributed cache");
            builder.Services.AddDistributedMemoryCache();
        }
    }
    else
    {
        Log.Warning("RedisConfig env var not set — using in-memory distributed cache (development only)");
        builder.Services.AddDistributedMemoryCache();
    }

    // ── Session ──
    builder.Services.AddSession(options =>
    {
        options.Cookie.Name = "hub_session";
        options.IdleTimeout = TimeSpan.FromMinutes(60 * 24);
    });

    // ── Connection String Manager (Redis-backed) ──
    builder.Services.AddSingleton<IConnectionStringManager, ConnectionStringManager>();

    // ── Entity Framework Core (multi-tenant) ──
    builder.Services.AddDbContextFactory<SetupDashboard.Models.DespatchContext>(options =>
        options.UseSqlServer(
            "Server=(localdb)\\mssqllocaldb;Database=dummy;Trusted_Connection=True;"
        ), ServiceLifetime.Transient);

    builder.Services.AddScoped<IDbContextFactory<DynamicDespatchDbContext>, DynamicDespatchDbContextFactory>();

    // ── Access Control switch (hub-tile-setup-dashboard) ──
    // [RequireFeature] on every controller, so turning the tile off in Access
    // Control blocks the app rather than just hiding the tile. DF Admin
    // (ClientTypeId 5) bypasses by default and never reaches the store.
    //
    // The store connects from the Hub cookie's Connection claim plus
    // SQLCredentials - the same value LoginController.Validate caches - and NOT
    // through DynamicDespatchDbContextFactory: that reads the Redis cache, which
    // is empty until the SPA has called Validate, so the first page load would
    // fail.
    builder.Services.AddAccessControlFeatures();
    builder.Services.AddSqlFeatureCatalogueStore((sp, _) =>
    {
        var user = sp.GetRequiredService<IHttpContextAccessor>().HttpContext?.User;
        var connection = user?.FindFirst("Connection")?.Value;
        if (string.IsNullOrEmpty(connection) || string.IsNullOrEmpty(user?.FindFirst("CurrentTenantID")?.Value))
            throw new UnauthorizedAccessException("Valid tenant authentication required. Please login via Hub first.");

        var credentials = Environment.GetEnvironmentVariable("SQLCredentials") ?? "";
        return Task.FromResult<System.Data.Common.DbConnection>(
            new Microsoft.Data.SqlClient.SqlConnection(connection + credentials));
    });

    // ── Health Checks ──
    builder.Services.AddHealthChecks()
        .AddCheck<SqlServerHealthCheck>("sql_server_health_check");

    // ── Application Services ──
    // Session store: Redis-backed in production, in-memory fallback for dev
    if (!string.IsNullOrEmpty(redisConfig))
    {
        builder.Services.AddSingleton<ISessionStore, RedisSessionStore>();
        Log.Information("Using Redis-backed session store");
    }
    else
    {
        builder.Services.AddSingleton<ISessionStore, InMemorySessionStore>();
        Log.Information("Using in-memory session store (development only)");
    }
    builder.Services.AddSingleton<SmartUploaderService>();
    builder.Services.AddSingleton<AdminManagerClientFactory>();
    builder.Services.AddSingleton<ProvisioningService>();
    builder.Services.AddHttpClient("HubProxy");

    // AWS S3 for tenant logo (same pattern as Hub)
    builder.Services.AddMemoryCache();
    builder.Services.AddSingleton<IAmazonS3>(_ =>
    {
        var chain = new CredentialProfileStoreChain();
        AWSCredentials? credentials = null;

        // Try named profile first (matches local AWS config), then default, then fallback
        foreach (var profile in new[] { "deliver-dfrnt", "default" })
        {
            if (chain.TryGetAWSCredentials(profile, out credentials))
            {
                Log.Information("Loaded AWS credentials from profile: {Profile}", profile);
                break;
            }
        }
        credentials ??= FallbackCredentialsFactory.GetCredentials();

        return new AmazonS3Client(credentials, new AmazonS3Config
        {
            RegionEndpoint = RegionEndpoint.APSoutheast2
        });
    });
    builder.Services.AddScoped<ITenantLogoService, TenantLogoService>();

    var app = builder.Build();

    // ── Middleware pipeline ──
    app.UseSerilogRequestLogging();

    app.UseCors();

    // Global error handler
    app.Use(async (context, next) =>
    {
        try
        {
            await next();
        }
        catch (KeyNotFoundException ex)
        {
            context.Response.StatusCode = 404;
            await context.Response.WriteAsJsonAsync(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            context.Response.StatusCode = 500;
            await context.Response.WriteAsJsonAsync(new { message = ex.Message });
        }
    });

    app.UseAuthentication();

    // Development-only: auto-authenticate anonymous requests for API testing
    if (app.Environment.IsDevelopment())
    {
        // Cache a dev connection string for TenantID=999 so validation endpoints can query the DB
        var devConnMgr = app.Services.GetRequiredService<IConnectionStringManager>();
        var devCredentials = Environment.GetEnvironmentVariable("SQLCredentials") ?? "";
        var devBaseConn = "Server=UCLHQLPHP2025\\MSSQL;database=DFRNT_SEED_CR;TrustServerCertificate=True;";
        devConnMgr.SetConnectionStringAsync("999-SetupDashboard-Connection", devBaseConn + devCredentials)
            .GetAwaiter().GetResult();
        Log.Information("Dev mode: cached connection string for TenantID=999");

        app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments("/api") &&
                !(context.User.Identity?.IsAuthenticated ?? false))
            {
                var claims = new[]
                {
                    new System.Security.Claims.Claim("CurrentTenantID", "999"),
                    new System.Security.Claims.Claim("ContactID", "1"),
                    new System.Security.Claims.Claim("StaffID", "1"),
                    new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Name, "DevTester"),
                };
                var identity = new System.Security.Claims.ClaimsIdentity(claims, "DevBypass");
                context.User = new System.Security.Claims.ClaimsPrincipal(identity);
            }
            await next();
        });
    }

    app.UseAuthorization();
    app.UseSession();

    app.UseStaticFiles();

    app.MapControllers();

    // SPA fallback — only fires when no static file or API route matched.
    // UseStaticFiles() serves JS/CSS/images first, then this catches
    // directory URLs like /setup-dashboard/ and routes to HomeController
    // which has [Authorize] → unauthenticated users redirect to Hub.
    app.MapFallbackToController("Index", "Home");

    // Health check endpoints
    app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
    app.MapHealthChecks("/healthz", new HealthCheckOptions
    {
        ResponseWriter = async (context, report) =>
        {
            context.Response.ContentType = "application/json";
            var response = new
            {
                Status = report.Status.ToString(),
                Checks = report.Entries.Select(e => new
                {
                    Component = e.Key,
                    Status = e.Value.Status.ToString(),
                    Description = e.Value.Description
                }),
                Duration = report.TotalDuration
            };
            await context.Response.WriteAsJsonAsync(response);
        }
    });


    Log.Information("CORS origins: {Origins}", string.Join(", ", corsOrigins));
    Log.Information("Cookie domain: {Domain}", domain);

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
