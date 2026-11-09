using System.Net;
using System.Text;
using System.Text.Json;
using Anthropic.Models.Beta.Messages;
using SetupDashboard.Models;
using SetupDashboard.Services.Ai;

namespace SetupDashboard.Tests;

public sealed class AnthropicClientFactoryTests : IDisposable
{
    private const string IdentityJwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJzeXN0ZW06c2VydmljZWFjY291bnQ6c2Q6ZGVmYXVsdCJ9.sig";
    private const string AccessToken = "sk-ant-oat01-federated";

    private readonly string _tokenFile = Path.GetTempFileName();
    private readonly List<(string Path, string Body, string? Authorization, string? ApiKey)> _requests = [];

    public AnthropicClientFactoryTests() => File.WriteAllText(_tokenFile, IdentityJwt);

    public void Dispose() => File.Delete(_tokenFile);

    private AnthropicFederationOptions Federation(string? tokenFile = null) => new()
    {
        RuleId = "fdrl_test",
        OrganizationId = "00000000-0000-0000-0000-000000000001",
        ServiceAccountId = "svac_test",
        IdentityTokenFile = tokenFile ?? _tokenFile
    };

    private HttpClient Http() => new(new RecordingHandler(request =>
    {
        var body = request.Content?.ReadAsStringAsync().GetAwaiter().GetResult() ?? "";
        lock (_requests)
        {
            _requests.Add((request.RequestUri!.AbsolutePath, body, request.Headers.Authorization?.ToString(),
                request.Headers.TryGetValues("x-api-key", out var key) ? key.Single() : null));
        }

        var json = request.RequestUri.AbsolutePath == "/v1/oauth/token"
            ? $$"""{"access_token":"{{AccessToken}}","token_type":"Bearer","expires_in":3600}"""
            : """
              {"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-5-5",
               "content":[{"type":"text","text":"{\"mappings\":[]}"}],"stop_reason":"end_turn","stop_sequence":null,
               "usage":{"input_tokens":1,"output_tokens":1}}
              """;
        return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
    }));

    private static MessageCreateParams Request() => new()
    {
        Model = "claude-opus-5-5",
        MaxTokens = 16,
        Messages = [new BetaUserMessageParam { Content = "hi" }]
    };

    [Fact]
    public async Task With_federation_the_identity_token_is_exchanged_and_sent_as_a_bearer()
    {
        var client = AnthropicClientFactory.Create(Federation(), 0, Http());

        await client.Beta.Messages.Create(Request(), CancellationToken.None);

        var exchange = Assert.Single(_requests, r => r.Path == "/v1/oauth/token");
        using var body = JsonDocument.Parse(exchange.Body);
        Assert.Equal("urn:ietf:params:oauth:grant-type:jwt-bearer", body.RootElement.GetProperty("grant_type").GetString());
        Assert.Equal(IdentityJwt, body.RootElement.GetProperty("assertion").GetString());
        Assert.Equal("fdrl_test", body.RootElement.GetProperty("federation_rule_id").GetString());
        Assert.Equal("00000000-0000-0000-0000-000000000001", body.RootElement.GetProperty("organization_id").GetString());
        Assert.Equal("svac_test", body.RootElement.GetProperty("service_account_id").GetString());

        var message = Assert.Single(_requests, r => r.Path == "/v1/messages");
        Assert.Equal($"Bearer {AccessToken}", message.Authorization);
        Assert.Null(message.ApiKey);
    }

    [Fact]
    public async Task The_exchanged_token_is_reused_across_calls()
    {
        var client = AnthropicClientFactory.Create(Federation(), 0, Http());

        await client.Beta.Messages.Create(Request(), CancellationToken.None);
        await client.Beta.Messages.Create(Request(), CancellationToken.None);

        Assert.Single(_requests, r => r.Path == "/v1/oauth/token");
        Assert.Equal(2, _requests.Count(r => r.Path == "/v1/messages"));
    }

    [Fact]
    public async Task Without_federation_an_api_key_left_in_the_environment_is_not_used()
    {
        var previous = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
        Environment.SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-api03-leftover");
        try
        {
            var client = AnthropicClientFactory.Create(new AnthropicFederationOptions(), 0, Http());

            await Record.ExceptionAsync(() => client.Beta.Messages.Create(Request(), CancellationToken.None));

            Assert.DoesNotContain(_requests, r => r.ApiKey == "sk-ant-api03-leftover");
            Assert.DoesNotContain(_requests, r => r.Path == "/v1/oauth/token");
        }
        finally
        {
            Environment.SetEnvironmentVariable("ANTHROPIC_API_KEY", previous);
        }
    }

    [Fact]
    public void Connected_needs_the_whole_rule_and_an_identity_token_file()
    {
        Assert.False(new AnthropicFederationOptions().IsConnected);
        Assert.True(Federation().IsConnected);
        Assert.False(new AnthropicFederationOptions { RuleId = "fdrl_test", IdentityTokenFile = _tokenFile }.IsConnected);
        Assert.False(Federation(Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"))).IsConnected);
    }

    [Fact]
    public async Task Smart_import_falls_back_to_the_name_match_when_the_identity_token_is_missing()
    {
        var client = AnthropicClientFactory.Create(Federation(Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"))), 0, Http());
        var advisor = new ClaudeColumnMappingAdvisor(client);

        var suggestions = await advisor.SuggestAsync("team", [new ColumnSample("Zzq", ["999"])],
            [new EntityFieldDefinition { FieldName = "Mobile", DisplayName = "Mobile" }]);

        Assert.Empty(suggestions);
        Assert.DoesNotContain(_requests, r => r.Path == "/v1/messages");
    }
}
