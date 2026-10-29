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
    // Every endpoint needs a signed-in Hub user unless it opts out (health checks only).
    // The pre-rewrite controllers were [AllowAnonymous] almost throughout.
    builder.Services.AddAuthorization(options =>
    {
        options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .Build();
    });

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
            builder.Services.AddSingleton<IConnectionMultiplexer>(redis);
            builder.Services.AddSingleton<IPushLock, RedisPushLock>();
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Redis connection failed — falling back to in-memory distributed cache");
            builder.Services.AddDistributedMemoryCache();
            builder.Services.AddSingleton<IPushLock, InMemoryPushLock>();
        }
    }
    else
    {
        Log.Warning("RedisConfig env var not set — using in-memory distributed cache (development only)");
        builder.Services.AddDistributedMemoryCache();
        builder.Services.AddSingleton<IPushLock, InMemoryPushLock>();
    }

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
    // Onboarding sessions live in the distributed cache (Redis when RedisConfig is set).
    builder.Services.AddSingleton<ISessionStore, DistributedSessionStore>();
    builder.Services.AddSingleton<SmartUploaderService>();

    // ── Writes go to the apps that own the data, as the signed-in person ──
    // No redirects followed (a 302 means the Hub cookie expired) and no cookie jar: the
    // caller's own cookie is attached per request, so one person's session can never ride
    // on another's call - the old singleton Admin Manager client could do exactly that.
    builder.Services.AddHttpClient(SetupDashboard.Services.TenantApps.TenantAppClient.HttpClientName, c =>
        {
            c.Timeout = TimeSpan.FromSeconds(builder.Configuration.GetValue("TenantApps:TimeoutSeconds", 60));
        })
        .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false });
    builder.Services.AddSingleton<SetupDashboard.Services.TenantApps.ITenantAppUrls>(sp => new SetupDashboard.Services.TenantApps.TenantAppUrls(
        sp.GetRequiredService<IConfiguration>(), sp.GetRequiredService<IHttpContextAccessor>()));
    builder.Services.AddScoped<SetupDashboard.Services.TenantApps.ITenantAppClient, SetupDashboard.Services.TenantApps.TenantAppClient>();
    builder.Services.AddScoped<SetupDashboard.Services.Steps.IStepPusher, SetupDashboard.Services.Steps.TeamPusher>();
    builder.Services.AddScoped<SetupDashboard.Services.Steps.IStepPusher, SetupDashboard.Services.Steps.ClientsPusher>();
    builder.Services.AddScoped<SetupDashboard.Services.Steps.IStepPusher, SetupDashboard.Services.Steps.RatesPusher>();
    builder.Services.AddScoped<SetupDashboard.Services.Steps.IStepPusher, SetupDashboard.Services.Steps.SchedulesPusher>();
    builder.Services.AddScoped<SetupDashboard.Services.Steps.IStepPusher, SetupDashboard.Services.Steps.CouriersPusher>();
    builder.Services.AddScoped<SetupDashboard.Services.Steps.IStepPusher, SetupDashboard.Services.Steps.PartnersPusher>();
    builder.Services.AddScoped<SetupDashboard.Services.Steps.StepPushRunner>();

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

    // (The development-only bypass that signed every anonymous /api call in as tenant 999 is
    // gone. Run locally behind a local Hub so a real shared cookie is present.)

    app.UseAuthorization();

    app.UseStaticFiles();

    app.MapControllers();

    // SPA fallback — only fires when no static file or API route matched.
    // UseStaticFiles() serves JS/CSS/images first, then this catches
    // directory URLs like /setup-dashboard/ and routes to HomeController
    // which has [Authorize] → unauthenticated users redirect to Hub.
    app.MapFallbackToController("Index", "Home");

    // Health check endpoints
    app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
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
    }).AllowAnonymous();


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
