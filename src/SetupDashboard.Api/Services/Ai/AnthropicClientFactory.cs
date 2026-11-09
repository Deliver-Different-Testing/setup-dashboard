using Anthropic;
using Anthropic.Core;
using Anthropic.Credentials;
using Anthropic.Exceptions;
using Serilog;

namespace SetupDashboard.Services.Ai;

/// <summary>
/// Claude is reached as this pod: its service-account token is exchanged for a short-lived Anthropic token
/// (workload identity federation), so there is no API key. The ids aren't secret; they live under
/// <c>Anthropic:Federation</c> in appsettings.json.
/// </summary>
public sealed class AnthropicFederationOptions
{
    public const string SectionName = "Anthropic:Federation";

    public string? RuleId { get; set; }
    public string? OrganizationId { get; set; }
    public string? ServiceAccountId { get; set; }
    public string? WorkspaceId { get; set; }
    public string IdentityTokenFile { get; set; } = "/var/run/secrets/anthropic.com/token";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(RuleId)
                                && !string.IsNullOrWhiteSpace(OrganizationId)
                                && !string.IsNullOrWhiteSpace(ServiceAccountId);

    /// <summary>False locally, where no identity token is mounted.</summary>
    public bool IsConnected => IsConfigured && File.Exists(IdentityTokenFile);
}

public static class AnthropicClientFactory
{
    public const string NotConnectedMessage = "Sorry, I'm not connected right now. Please try again later.";

    /// <summary>
    /// Build one client per process and share it: each identity token can be exchanged only once, so a second set
    /// of credentials reading the same file is refused (<c>jti_reused</c>).
    /// </summary>
    public static AnthropicClient Create(AnthropicFederationOptions federation, int maxRetries, HttpClient? httpClient = null)
    {
        var clientOptions = new ClientOptions { MaxRetries = maxRetries };
        if (httpClient is not null)
        {
            clientOptions.HttpClient = httpClient;
        }

        if (!federation.IsConfigured)
        {
            // An empty key stops the SDK falling back to an ANTHROPIC_API_KEY left in the environment.
            clientOptions.ApiKey = string.Empty;
            return new AnthropicClient(clientOptions);
        }

        Log.Information("Anthropic client authenticating via workload identity federation (rule {RuleId})", federation.RuleId);
        clientOptions.Credentials = new WorkloadIdentityCredentials(new WorkloadIdentityOptions
        {
            FederationRuleId = federation.RuleId!,
            OrganizationId = federation.OrganizationId,
            ServiceAccountId = federation.ServiceAccountId,
            WorkspaceId = string.IsNullOrWhiteSpace(federation.WorkspaceId) ? null : federation.WorkspaceId,
            IdentityTokenProvider = new FileIdentityTokenProvider(federation.IdentityTokenFile),
            HttpClient = httpClient
        });
        return new AnthropicClient(clientOptions);
    }

    /// <summary>The identity token is missing or Anthropic refused it: nothing a retry or the person can fix.</summary>
    public static bool IsNotConnected(Exception e) =>
        e is AnthropicUnauthorizedException or WorkloadIdentityException or FileNotFoundException or DirectoryNotFoundException;
}
