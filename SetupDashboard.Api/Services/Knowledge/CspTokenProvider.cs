using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Serilog;

namespace SetupDashboard.Services.Knowledge;

/// <summary>
/// Asks CSP for a service token: the pod's projected service-account token exchanged (RFC 8693) for a CSP token,
/// or, in Development only, the client secret. Tokens are cached per CSP address, refreshed five minutes before
/// they expire, and fetched by one caller at a time. Any failure is a null token, never an exception.
/// </summary>
public sealed class CspTokenProvider(
    IHttpClientFactory httpClientFactory,
    ServiceAuthOptions options,
    IHostEnvironment environment,
    TimeProvider timeProvider) : IServiceTokenProvider
{
    public const string HttpClientName = "csp-knowledge";

    private static readonly TimeSpan RefreshMargin = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan HalfLifeThreshold = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan WarningInterval = TimeSpan.FromMinutes(1);

    private readonly ConcurrentDictionary<string, Slot> _slots = new();
    private long _lastWarningTicks = long.MinValue;

    public bool IsConfigured => DevSecretUsable || File.Exists(options.AssertionPath);

    private bool DevSecretUsable => environment.IsDevelopment() && !string.IsNullOrWhiteSpace(options.ClientSecret);

    public async Task<string?> GetTokenAsync(string baseUrl, CancellationToken ct)
    {
        var key = baseUrl.TrimEnd('/');
        var slot = _slots.GetOrAdd(key, _ => new Slot());
        if (TryGetCached(slot, out var cached))
        {
            return cached;
        }

        await slot.Gate.WaitAsync(ct);
        try
        {
            if (TryGetCached(slot, out cached))
            {
                return cached;
            }

            var fetched = await RequestAsync(key, ct);
            if (fetched is not null)
            {
                lock (slot)
                {
                    slot.Cached = fetched;
                }
            }

            return fetched?.Value;
        }
        finally
        {
            slot.Gate.Release();
        }
    }

    public void Invalidate(string baseUrl)
    {
        if (_slots.TryGetValue(baseUrl.TrimEnd('/'), out var slot))
        {
            lock (slot)
            {
                slot.Cached = null;
            }
        }
    }

    private bool TryGetCached(Slot slot, out string? token)
    {
        lock (slot)
        {
            if (slot.Cached is { } entry && timeProvider.GetUtcNow() < entry.RefreshAt)
            {
                token = entry.Value;
                return true;
            }
        }

        token = null;
        return false;
    }

    private async Task<CachedToken?> RequestAsync(string baseUrl, CancellationToken ct)
    {
        try
        {
            using var request = BuildRequest($"{baseUrl}/api/v1/knowledge/token");
            if (request is null)
            {
                return null;
            }

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(5));

            using var response = await httpClientFactory.CreateClient(HttpClientName).SendAsync(request, timeout.Token);
            if (!response.IsSuccessStatusCode)
            {
                Warn($"CSP token endpoint returned {(int)response.StatusCode}");
                return null;
            }

            var body = await response.Content.ReadFromJsonAsync<TokenResponse>(timeout.Token);
            if (body is null || string.IsNullOrWhiteSpace(body.AccessToken) || body.ExpiresIn <= 0)
            {
                Warn("CSP token response was missing access_token or expires_in");
                return null;
            }

            if (!string.Equals(body.TokenType, "Bearer", StringComparison.OrdinalIgnoreCase))
            {
                Warn("CSP token response token_type was not Bearer");
                return null;
            }

            var lifetime = TimeSpan.FromSeconds(body.ExpiresIn);
            var refreshIn = lifetime > HalfLifeThreshold ? lifetime - RefreshMargin : lifetime / 2;
            return new CachedToken(body.AccessToken, timeProvider.GetUtcNow() + refreshIn);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            Warn($"CSP token request failed ({ex.GetType().Name})");
            return null;
        }
    }

    private HttpRequestMessage? BuildRequest(string url)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);

        if (DevSecretUsable)
        {
            request.Content = new FormUrlEncodedContent(
            [
                new KeyValuePair<string, string>("grant_type", "client_credentials"),
                new KeyValuePair<string, string>("client_id", options.ClientId),
                new KeyValuePair<string, string>("client_secret", options.ClientSecret!)
            ]);
            return request;
        }

        string assertion;
        try
        {
            assertion = File.ReadAllText(options.AssertionPath).Trim();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            request.Dispose();
            Warn($"Service account token file could not be read ({ex.GetType().Name})");
            return null;
        }

        if (assertion.Length == 0)
        {
            request.Dispose();
            Warn("Service account token file is empty");
            return null;
        }

        request.Content = new FormUrlEncodedContent(
        [
            new KeyValuePair<string, string>("grant_type", "urn:ietf:params:oauth:grant-type:token-exchange"),
            new KeyValuePair<string, string>("subject_token", assertion),
            new KeyValuePair<string, string>("subject_token_type", "urn:ietf:params:oauth:token-type:jwt"),
            new KeyValuePair<string, string>("audience", "csp")
        ]);
        return request;
    }

    private void Warn(string message)
    {
        var now = timeProvider.GetUtcNow().UtcTicks;
        var last = Interlocked.Read(ref _lastWarningTicks);
        if (last != long.MinValue && now - last < WarningInterval.Ticks)
        {
            return;
        }

        if (Interlocked.CompareExchange(ref _lastWarningTicks, now, last) == last)
        {
            Log.Warning("Service token unavailable: {Reason}", message);
        }
    }

    private sealed class Slot
    {
        public SemaphoreSlim Gate { get; } = new(1, 1);
        public CachedToken? Cached { get; set; }
    }

    private sealed record CachedToken(string Value, DateTimeOffset RefreshAt);

    private sealed class TokenResponse
    {
        [JsonPropertyName("access_token")]
        public string? AccessToken { get; set; }

        [JsonPropertyName("token_type")]
        public string? TokenType { get; set; }

        [JsonPropertyName("expires_in")]
        public int ExpiresIn { get; set; }
    }
}
