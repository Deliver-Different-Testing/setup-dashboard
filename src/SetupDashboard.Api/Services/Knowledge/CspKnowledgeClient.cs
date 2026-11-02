using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Services.Knowledge;

/// <summary>
/// Reads the CSP Knowledge Base as this app (service token, not the person's cookie). CSP's address comes from
/// <see cref="CspKnowledgeOptions.BaseUrl"/> or this pod's own tenant domain, never from the request, so the
/// token can't be steered by a forged Host header. The token only ever goes over https; http is accepted in
/// Development alone. Hits outside <see cref="CspKnowledgeOptions.AllowedLayers"/> are dropped.
/// </summary>
public sealed class CspKnowledgeClient(
    IHttpClientFactory httpClientFactory,
    IServiceTokenProvider tokenProvider,
    CspKnowledgeCircuit circuit,
    ITenantAppUrls urls,
    CspKnowledgeOptions options,
    IHostEnvironment environment) : ICspKnowledgeClient
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public bool IsConfigured => BaseUrl() is not null && tokenProvider.IsConfigured;

    public async Task<CspKbSearchResult> SearchAsync(string query, int limit, TimeSpan timeout, CancellationToken ct)
    {
        if (BaseUrl() is not { } baseUrl || !tokenProvider.IsConfigured || circuit.IsOpen(baseUrl))
        {
            return CspKbSearchResult.Unavailable;
        }

        if (string.IsNullOrWhiteSpace(query))
        {
            return new CspKbSearchResult(CspKbStatus.Ok, []);
        }

        var call = await GetAsync<List<CspKbHit>>(baseUrl, $"api/v1/knowledge/search?q={Uri.EscapeDataString(query)}&limit={limit}", timeout, ct);
        if (call.Outcome != Outcome.Ok)
        {
            return CspKbSearchResult.Unavailable;
        }

        var allowed = (call.Body ?? [])
            .Where(h => h.Layer is { } layer && options.AllowedLayers.Contains(layer, StringComparer.OrdinalIgnoreCase))
            .ToList();
        return new CspKbSearchResult(CspKbStatus.Ok, allowed);
    }

    public async Task<CspKbArticleResult> GetArticleAsync(Guid id, TimeSpan timeout, CancellationToken ct)
    {
        if (BaseUrl() is not { } baseUrl || !tokenProvider.IsConfigured || circuit.IsOpen(baseUrl))
        {
            return CspKbArticleResult.Unavailable;
        }

        var call = await GetAsync<CspKbArticle>(baseUrl, $"api/v1/knowledge/articles/{id}", timeout, ct, notFoundIsAbsence: true);
        return call.Outcome switch
        {
            Outcome.Ok when call.Body is not null => new CspKbArticleResult(CspKbStatus.Ok, call.Body),
            Outcome.NotFound => new CspKbArticleResult(CspKbStatus.NotFound, null),
            _ => CspKbArticleResult.Unavailable
        };
    }

    private string? BaseUrl()
    {
        var baseUrl = string.IsNullOrWhiteSpace(options.BaseUrl) ? urls.BaseUrlForPodDomain("csp") : options.BaseUrl.Trim();
        if (baseUrl is null || !Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri))
        {
            return null;
        }

        var allowed = uri.Scheme == Uri.UriSchemeHttps || environment.IsDevelopment() && uri.Scheme == Uri.UriSchemeHttp;
        return allowed ? baseUrl.TrimEnd('/') : null;
    }

    private async Task<(Outcome Outcome, T? Body)> GetAsync<T>(
        string baseUrl, string path, TimeSpan timeout, CancellationToken ct, bool notFoundIsAbsence = false) where T : class
    {
        var endpoint = path.Split('?')[0];
        using var budget = CancellationTokenSource.CreateLinkedTokenSource(ct);
        budget.CancelAfter(timeout);

        try
        {
            var url = $"{baseUrl}/{path}";

            var token = await tokenProvider.GetTokenAsync(baseUrl, budget.Token);
            if (token is null)
            {
                circuit.RecordFailure(baseUrl, $"{endpoint} no service token", permanent: false);
                return (Outcome.Failed, null);
            }

            var response = await SendAsync(url, token, budget.Token);
            if (response.StatusCode == HttpStatusCode.Unauthorized)
            {
                response.Dispose();
                tokenProvider.Invalidate(baseUrl);
                token = await tokenProvider.GetTokenAsync(baseUrl, budget.Token);
                if (token is null)
                {
                    circuit.RecordFailure(baseUrl, $"{endpoint} no service token", permanent: false);
                    return (Outcome.Failed, null);
                }

                response = await SendAsync(url, token, budget.Token);
            }

            using var _ = response;

            if (response.StatusCode == HttpStatusCode.NotFound && notFoundIsAbsence)
            {
                return (Outcome.NotFound, null);
            }

            if (!response.IsSuccessStatusCode)
            {
                var permanent = response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden;
                circuit.RecordFailure(baseUrl, $"{endpoint} returned {(int)response.StatusCode}", permanent);
                return (Outcome.Failed, null);
            }

            var body = await response.Content.ReadFromJsonAsync<T>(JsonOptions, budget.Token);
            circuit.RecordSuccess(baseUrl);
            return (Outcome.Ok, body);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            circuit.RecordFailure(baseUrl, $"{endpoint} {ex.GetType().Name}", permanent: false);
            return (Outcome.Failed, null);
        }
    }

    private async Task<HttpResponseMessage> SendAsync(string url, string token, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await httpClientFactory.CreateClient(CspTokenProvider.HttpClientName).SendAsync(request, ct);
    }

    private enum Outcome
    {
        Ok,
        NotFound,
        Failed
    }
}
