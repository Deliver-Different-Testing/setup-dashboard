using System.Net;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using SetupDashboard.Services.Knowledge;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Tests;

public sealed class FakeTokens(params string?[] tokens) : IServiceTokenProvider
{
    private int _next;
    public bool IsConfigured { get; set; } = true;
    public int Invalidations { get; private set; }
    public List<string> Asked { get; } = [];

    public Task<string?> GetTokenAsync(string baseUrl, CancellationToken ct)
    {
        Asked.Add(baseUrl);
        return Task.FromResult(tokens[Math.Min(_next++, tokens.Length - 1)]);
    }

    public void Invalidate(string baseUrl) => Invalidations++;
}

public class CspKnowledgeClientTests
{
    private const string Csp = "https://dfrntcrm.cheetah.staging.deliverdifferent.com";
    private static readonly TimeSpan Budget = TimeSpan.FromSeconds(5);

    private static (CspKnowledgeClient Client, RecordingHandler Handler, CspKnowledgeCircuit Circuit) Build(
        Func<HttpRequestMessage, HttpResponseMessage> respond, IServiceTokenProvider? tokens = null,
        string env = "Production", string? podDomain = ".cheetah.staging.deliverdifferent.com",
        string host = "setupdashboard.cheetah.staging.deliverdifferent.com", CspKnowledgeOptions? options = null)
    {
        var settings = new Dictionary<string, string?>
            { ["TenantApps:Hosts:Csp"] = "dfrntcrm", ["TenantApps:LocalPorts:Csp"] = "5310", ["Domain"] = podDomain ?? "" };
        var environment = new Microsoft.Extensions.Hosting.Internal.HostingEnvironment { EnvironmentName = env };
        var http = Make.Http(Make.User(), "", host);
        var urls = new TenantAppUrls(new ConfigurationBuilder().AddInMemoryCollection(settings).Build(), http, environment);
        var handler = new RecordingHandler(respond);
        var circuit = new CspKnowledgeCircuit();
        return (new CspKnowledgeClient(new SingleClientFactory(handler), tokens ?? new FakeTokens("t1"), circuit, urls,
            options ?? new CspKnowledgeOptions(), environment), handler, circuit);
    }

    private static string Hit(string title, string? layer) =>
        "{\"articleId\":\"" + Guid.NewGuid() + "\",\"title\":\"" + title + "\",\"isFaq\":false,\"score\":1.0,\"content\":\"Body\""
        + (layer is null ? "" : ",\"layer\":\"" + layer + "\"") + "}";

    private static string HitsJson => $"[{Hit("Zones", "shipped")}]";

    [Fact]
    public async Task Search_sends_the_bearer_token_to_the_tenants_csp()
    {
        var (client, handler, _) = Build(_ => Make.Json(HttpStatusCode.OK, HitsJson));

        var result = await client.SearchAsync("how do zones work", 3, Budget, CancellationToken.None);

        Assert.Equal(CspKbStatus.Ok, result.Status);
        Assert.Equal("Zones", result.Hits.Single().Title);
        var request = handler.Requests.Single();
        Assert.Equal($"{Csp}/api/v1/knowledge/search?q=how%20do%20zones%20work&limit=3", request.RequestUri!.AbsoluteUri);
        Assert.Equal("Bearer t1", request.Headers.Authorization!.ToString());
    }

    [Fact]
    public async Task A_401_refreshes_the_token_once_and_retries()
    {
        var tokens = new FakeTokens("old", "new");
        var calls = 0;
        var (client, handler, _) = Build(_ => ++calls == 1 ? new HttpResponseMessage(HttpStatusCode.Unauthorized) : Make.Json(HttpStatusCode.OK, "[]"), tokens);

        var result = await client.SearchAsync("zones", 3, Budget, CancellationToken.None);

        Assert.Equal(CspKbStatus.Ok, result.Status);
        Assert.Equal(1, tokens.Invalidations);
        Assert.Equal(["Bearer old", "Bearer new"], handler.Requests.Select(r => r.Headers.Authorization!.ToString()));
    }

    [Fact]
    public async Task A_second_401_is_unavailable_and_opens_the_circuit_at_once()
    {
        var (client, handler, circuit) = Build(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized), new FakeTokens("a", "b"));

        var first = await client.SearchAsync("zones", 3, Budget, CancellationToken.None);
        var second = await client.SearchAsync("zones", 3, Budget, CancellationToken.None);

        Assert.Equal(CspKbStatus.Unavailable, first.Status);
        Assert.Equal(CspKbStatus.Unavailable, second.Status);
        Assert.True(circuit.IsOpen(Csp));
        Assert.Equal(2, handler.Requests.Count);
    }

    [Fact]
    public async Task Three_transient_failures_open_the_circuit()
    {
        var (client, handler, circuit) = Build(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));

        for (var i = 0; i < 4; i++)
        {
            await client.SearchAsync("zones", 3, Budget, CancellationToken.None);
        }

        Assert.True(circuit.IsOpen(Csp));
        Assert.Equal(3, handler.Requests.Count);
    }

    [Fact]
    public async Task No_token_is_unavailable()
    {
        var (client, handler, _) = Build(_ => Make.Json(HttpStatusCode.OK, "[]"), new FakeTokens((string?)null));

        Assert.Equal(CspKbStatus.Unavailable, (await client.SearchAsync("zones", 3, Budget, CancellationToken.None)).Status);
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task A_missing_article_is_not_found_not_unavailable()
    {
        var (client, _, circuit) = Build(_ => new HttpResponseMessage(HttpStatusCode.NotFound));

        var result = await client.GetArticleAsync(Guid.NewGuid(), Budget, CancellationToken.None);

        Assert.Equal(CspKbStatus.NotFound, result.Status);
        Assert.False(circuit.IsOpen(Csp));
    }

    [Fact]
    public async Task An_article_is_read_with_its_faqs()
    {
        var id = Guid.NewGuid();
        var (client, handler, _) = Build(_ => Make.Json(HttpStatusCode.OK,
            $"{{\"articleId\":\"{id}\",\"title\":\"Zones\",\"content\":\"Body\",\"faqs\":[{{\"question\":\"Q\",\"answer\":\"A\"}}]}}"));

        var result = await client.GetArticleAsync(id, Budget, CancellationToken.None);

        Assert.Equal(CspKbStatus.Ok, result.Status);
        Assert.Equal("Q", result.Article!.Faqs!.Single().Question);
        Assert.EndsWith($"/api/v1/knowledge/articles/{id}", handler.Requests.Single().RequestUri!.ToString());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("localhost")]
    [InlineData(".deliverdifferent.com")]
    [InlineData(".example.com")]
    public async Task No_csp_address_without_a_tenant_pod_domain(string? podDomain)
    {
        var (client, handler, _) = Build(_ => Make.Json(HttpStatusCode.OK, HitsJson), podDomain: podDomain);

        Assert.False(client.IsConfigured);
        Assert.Equal(CspKbStatus.Unavailable, (await client.SearchAsync("zones", 3, Budget, CancellationToken.None)).Status);
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public void Not_configured_without_a_token_source()
    {
        Assert.True(Build(_ => new HttpResponseMessage()).Client.IsConfigured);
        Assert.False(Build(_ => new HttpResponseMessage(), new FakeTokens("t") { IsConfigured = false }).Client.IsConfigured);
    }

    [Fact]
    public async Task The_request_host_never_picks_the_csp_the_token_goes_to()
    {
        var (client, handler, _) = Build(_ => Make.Json(HttpStatusCode.OK, "[]"), podDomain: ".deliverdifferent.com",
            host: "setupdashboard.othertenant.deliverdifferent.com");
        Assert.False(client.IsConfigured);

        var (pinned, pinnedHandler, _) = Build(_ => Make.Json(HttpStatusCode.OK, "[]"),
            host: "setupdashboard.medical.staging.deliverdifferent.com");
        await pinned.SearchAsync("zones", 3, Budget, CancellationToken.None);

        Assert.Empty(handler.Requests);
        Assert.StartsWith($"{Csp}/", pinnedHandler.Requests.Single().RequestUri!.AbsoluteUri);
    }

    [Fact]
    public async Task A_configured_base_url_wins_over_the_pod_domain()
    {
        var (client, handler, _) = Build(_ => Make.Json(HttpStatusCode.OK, "[]"), podDomain: null,
            options: new CspKnowledgeOptions { BaseUrl = "https://dfrntcrm.crossroadscourier.deliverdifferent.com/" });

        await client.SearchAsync("zones", 3, Budget, CancellationToken.None);

        Assert.StartsWith("https://dfrntcrm.crossroadscourier.deliverdifferent.com/api/", handler.Requests.Single().RequestUri!.AbsoluteUri);
    }

    [Fact]
    public async Task Hits_outside_the_allowed_layers_are_dropped()
    {
        var (client, _, _) = Build(_ => Make.Json(HttpStatusCode.OK,
            $"[{Hit("Shipped", "shipped")},{Hit("Tenant", "tenant")},{Hit("Client", "CLIENT")},{Hit("None", null)}]"));

        var result = await client.SearchAsync("zones", 3, Budget, CancellationToken.None);

        Assert.Equal(["Shipped", "Client"], result.Hits.Select(h => h.Title));
    }

    [Fact]
    public void Past_the_address_bound_the_circuit_treats_a_new_address_as_open()
    {
        var circuit = new CspKnowledgeCircuit();
        for (var i = 0; i < CspKnowledgeCircuit.MaxAddresses; i++)
        {
            Assert.False(circuit.IsOpen($"https://dfrntcrm.t{i}.deliverdifferent.com"));
        }

        Assert.True(circuit.IsOpen("https://dfrntcrm.extra.deliverdifferent.com"));
        Assert.False(circuit.IsOpen("https://dfrntcrm.t0.deliverdifferent.com"));
    }

    [Fact]
    public async Task Http_is_only_used_in_development()
    {
        var local = ".local.deliverdifferent.com";
        var (dev, handler, _) = Build(_ => Make.Json(HttpStatusCode.OK, "[]"), env: Environments.Development, podDomain: local);

        Assert.True(dev.IsConfigured);
        await dev.SearchAsync("zones", 3, Budget, CancellationToken.None);
        Assert.StartsWith("http://dfrntcrm.local.deliverdifferent.com:5310/", handler.Requests.Single().RequestUri!.ToString());

        Assert.False(Build(_ => new HttpResponseMessage(), podDomain: local).Client.IsConfigured);
        Assert.False(Build(_ => new HttpResponseMessage(), options: new CspKnowledgeOptions { BaseUrl = "http://dfrntcrm.cheetah.staging.deliverdifferent.com" })
            .Client.IsConfigured);
    }
}
