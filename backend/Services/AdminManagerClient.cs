using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using SetupDashboard.Models;

namespace SetupDashboard.Services;

/// <summary>
/// HTTP client for DFRNT Admin Manager API.
/// Ports the cookie-based auth pattern from the TypeScript MCP server.
/// 
/// Auth flow (from MCP server ARCHITECTURE.md):
///   1. GET hub login page → extract __RequestVerificationToken + anti-forgery cookie
///   2. POST credentials to hub → follow redirects → capture SharedCookie
///   3. POST /API/Login/Validate with SharedCookie → creates hub_session cookie
///   4. GET Dispatch URL → establishes dispatch session
///   5. All subsequent API calls use these cookies
/// </summary>
public class AdminManagerClient : IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly CookieContainer _cookieContainer;
    private readonly DfrntEnvironment _environment;
    private readonly ILogger<AdminManagerClient> _logger;
    private bool _initialized;
    private DateTime _lastLoginAttempt = DateTime.MinValue;
    private static readonly TimeSpan LoginCooldown = TimeSpan.FromMinutes(5);

    public AdminManagerClient(DfrntEnvironment environment, ILogger<AdminManagerClient> logger)
    {
        _environment = environment;
        _logger = logger;
        _cookieContainer = new CookieContainer();
        var handler = new HttpClientHandler
        {
            CookieContainer = _cookieContainer,
            AllowAutoRedirect = false,
            UseCookies = true,
        };
        _httpClient = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(30) };
        _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
    }

    /// <summary>
    /// Load cookies from a Playwright-format storage state file (same format as MCP server).
    /// File path: auth/{environment-key}.json
    /// </summary>
    public bool LoadSessionFromFile(string envKey)
    {
        var path = Path.Combine("auth", $"{envKey}.json");
        if (!File.Exists(path))
        {
            _logger.LogWarning("No session file at {Path}", path);
            return false;
        }

        try
        {
            var json = File.ReadAllText(path);
            var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("cookies", out var cookies))
                return false;

            foreach (var cookie in cookies.EnumerateArray())
            {
                var name = cookie.GetProperty("name").GetString()!;
                var value = cookie.GetProperty("value").GetString()!;
                var domain = cookie.GetProperty("domain").GetString()!;
                var cookiePath = cookie.TryGetProperty("path", out var p) ? p.GetString()! : "/";

                // Build URI from domain
                var scheme = "https";
                var cleanDomain = domain.TrimStart('.');
                var uri = new Uri($"{scheme}://{cleanDomain}");

                _cookieContainer.Add(uri, new Cookie(name, value, cookiePath, cleanDomain));
            }

            _initialized = true;
            _logger.LogInformation("Loaded session cookies from {Path}", path);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load session from {Path}", path);
            return false;
        }
    }

    /// <summary>
    /// Perform the 4-step login flow (ported from MCP server's http-login.ts).
    /// </summary>
    public async Task<bool> LoginAsync(string username, string password)
    {
        if (DateTime.UtcNow - _lastLoginAttempt < LoginCooldown)
        {
            _logger.LogWarning("Login cooldown active, skipping");
            return false;
        }
        _lastLoginAttempt = DateTime.UtcNow;

        try
        {
            // Step 1: GET hub login page → extract verification token
            var loginPageResponse = await _httpClient.GetAsync(_environment.HubLoginUrl);
            var loginPageHtml = await loginPageResponse.Content.ReadAsStringAsync();

            var tokenMatch = Regex.Match(loginPageHtml, @"__RequestVerificationToken.*?value=""([^""]+)""");
            if (!tokenMatch.Success)
            {
                _logger.LogError("Could not find __RequestVerificationToken on login page");
                return false;
            }
            var verificationToken = tokenMatch.Groups[1].Value;

            // Step 2: POST credentials to hub
            var loginContent = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("Username", username),
                new KeyValuePair<string, string>("Password", password),
                new KeyValuePair<string, string>("__RequestVerificationToken", verificationToken),
                new KeyValuePair<string, string>("RememberMe", "true"),
            });

            var loginResponse = await _httpClient.PostAsync(_environment.HubLoginUrl, loginContent);

            // Follow redirects manually to capture cookies
            while (loginResponse.StatusCode is HttpStatusCode.Redirect or HttpStatusCode.MovedPermanently)
            {
                var redirectUri = loginResponse.Headers.Location;
                if (redirectUri != null && !redirectUri.IsAbsoluteUri)
                    redirectUri = new Uri(new Uri(_environment.HubUrl), redirectUri);
                if (redirectUri == null) break;
                loginResponse = await _httpClient.GetAsync(redirectUri);
            }

            // Step 3: POST /API/Login/Validate to Admin Manager
            var validateUrl = $"{_environment.BaseUrl}/API/Login/Validate";
            var validateResponse = await _httpClient.PostAsync(validateUrl,
                new StringContent("{}", Encoding.UTF8, "application/json"));

            if (!validateResponse.IsSuccessStatusCode)
            {
                _logger.LogError("Login validation failed: {Status}", validateResponse.StatusCode);
                return false;
            }

            // Step 4: GET Dispatch URL to establish dispatch session
            try
            {
                await _httpClient.GetAsync(_environment.DispatchUrl);
            }
            catch
            {
                // Dispatch session is optional
            }

            _initialized = true;
            _logger.LogInformation("Login successful for {Env}", _environment.Name);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Login failed");
            return false;
        }
    }

    private Task EnsureInitialized()
    {
        if (!_initialized)
            throw new InvalidOperationException(
                $"Admin Manager client not initialized. Load a session file or call LoginAsync first. " +
                $"Expected session file at auth/{_environment.Name.ToLower().Replace(' ', '-')}.json");
        return Task.CompletedTask;
    }

    public async Task<T?> GetAsync<T>(string endpoint) where T : class
    {
        await EnsureInitialized();
        var url = endpoint.StartsWith("http") ? endpoint : $"{_environment.BaseUrl}{endpoint}";
        var response = await _httpClient.GetAsync(url);

        if (response.StatusCode == HttpStatusCode.Unauthorized ||
            response.StatusCode == HttpStatusCode.Found)
        {
            _logger.LogWarning("Session expired on GET {Endpoint}", endpoint);
            throw new UnauthorizedAccessException("Session expired");
        }

        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }

    public async Task<string> GetRawAsync(string endpoint)
    {
        await EnsureInitialized();
        var url = endpoint.StartsWith("http") ? endpoint : $"{_environment.BaseUrl}{endpoint}";
        var response = await _httpClient.GetAsync(url);

        if (response.StatusCode == HttpStatusCode.Unauthorized ||
            response.StatusCode == HttpStatusCode.Found)
        {
            _logger.LogWarning("Session expired on GET {Endpoint}", endpoint);
            throw new UnauthorizedAccessException("Session expired");
        }

        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync();
    }

    public async Task<T?> PostAsync<T>(string endpoint, object body) where T : class
    {
        await EnsureInitialized();
        var url = endpoint.StartsWith("http") ? endpoint : $"{_environment.BaseUrl}{endpoint}";
        var content = new StringContent(
            JsonSerializer.Serialize(body),
            Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, content);

        if (response.StatusCode == HttpStatusCode.Unauthorized ||
            response.StatusCode == HttpStatusCode.Found)
        {
            throw new UnauthorizedAccessException("Session expired");
        }

        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }

    public async Task<string> PostRawAsync(string endpoint, object body)
    {
        await EnsureInitialized();
        var url = endpoint.StartsWith("http") ? endpoint : $"{_environment.BaseUrl}{endpoint}";
        var content = new StringContent(
            JsonSerializer.Serialize(body),
            Encoding.UTF8, "application/json");
        var response = await _httpClient.PostAsync(url, content);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync();
    }

    public async Task DeleteAsync(string endpoint)
    {
        await EnsureInitialized();
        var url = endpoint.StartsWith("http") ? endpoint : $"{_environment.BaseUrl}{endpoint}";
        var response = await _httpClient.DeleteAsync(url);
        response.EnsureSuccessStatusCode();
    }

    public bool IsInitialized => _initialized;
    public DfrntEnvironment Environment => _environment;

    public void Dispose() => _httpClient.Dispose();
}

/// <summary>
/// Factory to create AdminManagerClient instances per environment.
/// Caches clients and auto-loads session files.
/// </summary>
public class AdminManagerClientFactory
{
    private readonly Dictionary<string, DfrntEnvironment> _environments;
    private readonly Dictionary<string, AdminManagerClient> _clients = new();
    private readonly ILoggerFactory _loggerFactory;

    public AdminManagerClientFactory(IConfiguration config, ILoggerFactory loggerFactory)
    {
        _loggerFactory = loggerFactory;
        _environments = new();

        var envSection = config.GetSection("Environments");
        foreach (var child in envSection.GetChildren())
        {
            var env = new DfrntEnvironment();
            child.Bind(env);
            _environments[child.Key] = env;
        }
    }

    public AdminManagerClient GetClient(string envKey)
    {
        if (_clients.TryGetValue(envKey, out var existing))
            return existing;

        if (!_environments.TryGetValue(envKey, out var env))
            throw new ArgumentException($"Unknown environment: {envKey}");

        var logger = _loggerFactory.CreateLogger<AdminManagerClient>();
        var client = new AdminManagerClient(env, logger);

        // Try to load session from file (shared with MCP server)
        client.LoadSessionFromFile(envKey);

        _clients[envKey] = client;
        return client;
    }

    public List<string> GetAvailableEnvironments() => _environments.Keys.ToList();

    public Dictionary<string, DfrntEnvironment> GetEnvironmentDetails() => _environments;
}
