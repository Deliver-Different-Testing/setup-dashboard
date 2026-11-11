namespace SetupDashboard.Services.Knowledge;

/// <summary>Bearer tokens for calling the Customer Success Platform as this app, one per CSP address.</summary>
public interface IServiceTokenProvider
{
    /// <summary>True when this pod has a way to ask for a token (the projected service-account file, or the Development secret).</summary>
    bool IsConfigured { get; }

    /// <summary>A current token for <paramref name="baseUrl"/>, or null when one can't be had.</summary>
    Task<string?> GetTokenAsync(string baseUrl, CancellationToken ct);

    /// <summary>Forget the cached token, e.g. after a 401, so the next call asks again.</summary>
    void Invalidate(string baseUrl);
}

public sealed class ServiceAuthOptions
{
    public const string SectionName = "ServiceAuth";

    public string ClientId { get; set; } = "setupdashboard";
    public string AssertionPath { get; set; } = "/var/run/secrets/dfrnt/csp-token";

    /// <summary>Development only: <c>ServiceAuth__ClientSecret</c>, CSP's <c>KnowledgeApi__DevBootstrapSecret</c>.</summary>
    public string? ClientSecret { get; set; }
}
