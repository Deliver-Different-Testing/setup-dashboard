using System.Net;
using Microsoft.Extensions.Hosting;
using SetupDashboard.Services.Knowledge;

namespace SetupDashboard.Tests;

public sealed class FakeTime(DateTimeOffset start) : TimeProvider
{
    private DateTimeOffset _now = start;
    public override DateTimeOffset GetUtcNow() => _now;
    public void Advance(TimeSpan by) => _now += by;
}

public sealed class CspTokenProviderTests : IDisposable
{
    private const string Csp = "https://dfrntcrm.cheetah.staging.deliverdifferent.com";

    private readonly string _file = Path.Combine(Path.GetTempPath(), $"csp-token-{Guid.NewGuid():N}");
    private readonly FakeTime _time = new(new DateTimeOffset(2026, 10, 30, 0, 0, 0, TimeSpan.Zero));

    public CspTokenProviderTests() => File.WriteAllText(_file, "  sa-jwt\n");

    public void Dispose() => File.Delete(_file);

    private static string TokenJson(int expiresIn = 3600, string type = "Bearer", string token = "csp-token")
        => $"{{\"access_token\":\"{token}\",\"issued_token_type\":\"x\",\"token_type\":\"{type}\",\"expires_in\":{expiresIn}}}";

    private (CspTokenProvider Provider, RecordingHandler Handler) Build(Func<HttpRequestMessage, HttpResponseMessage> respond,
        string env = "Production", string? secret = null, string? path = null)
    {
        var handler = new RecordingHandler(respond);
        var provider = new CspTokenProvider(new SingleClientFactory(handler),
            new ServiceAuthOptions { AssertionPath = path ?? _file, ClientSecret = secret },
            new Microsoft.Extensions.Hosting.Internal.HostingEnvironment { EnvironmentName = env }, _time);
        return (provider, handler);
    }

    [Fact]
    public async Task Exchanges_the_service_account_token_for_a_csp_token()
    {
        var (provider, handler) = Build(_ => Make.Json(HttpStatusCode.OK, TokenJson()));

        var token = await provider.GetTokenAsync(Csp, CancellationToken.None);

        Assert.Equal("csp-token", token);
        Assert.Equal($"{Csp}/api/v1/knowledge/token", handler.Requests.Single().RequestUri!.ToString());
        var form = Uri.UnescapeDataString(handler.Bodies.Single()!);
        Assert.Contains("grant_type=urn:ietf:params:oauth:grant-type:token-exchange", form);
        Assert.Contains("subject_token=sa-jwt", form);
        Assert.Contains("subject_token_type=urn:ietf:params:oauth:token-type:jwt", form);
        Assert.Contains("audience=csp", form);
    }

    [Fact]
    public async Task Development_uses_the_client_secret_and_ignores_it_elsewhere()
    {
        var (dev, devHandler) = Build(_ => Make.Json(HttpStatusCode.OK, TokenJson()), Environments.Development, "s3cret");
        await dev.GetTokenAsync(Csp, CancellationToken.None);
        var form = devHandler.Bodies.Single()!;
        Assert.Contains("grant_type=client_credentials", form);
        Assert.Contains("client_id=setupdashboard", form);
        Assert.Contains("client_secret=s3cret", form);

        var (prod, prodHandler) = Build(_ => Make.Json(HttpStatusCode.OK, TokenJson()), "Production", "s3cret");
        await prod.GetTokenAsync(Csp, CancellationToken.None);
        Assert.Contains("token-exchange", prodHandler.Bodies.Single());
        Assert.DoesNotContain("s3cret", prodHandler.Bodies.Single());
    }

    [Fact]
    public async Task Caches_until_five_minutes_before_expiry_then_asks_again()
    {
        var (provider, handler) = Build(_ => Make.Json(HttpStatusCode.OK, TokenJson(3600)));

        await provider.GetTokenAsync(Csp, CancellationToken.None);
        _time.Advance(TimeSpan.FromMinutes(54));
        await provider.GetTokenAsync(Csp, CancellationToken.None);
        Assert.Single(handler.Requests);

        _time.Advance(TimeSpan.FromMinutes(2));
        await provider.GetTokenAsync(Csp, CancellationToken.None);
        Assert.Equal(2, handler.Requests.Count);
    }

    [Fact]
    public async Task Past_the_address_bound_a_new_address_gets_no_token_and_no_request()
    {
        var (provider, handler) = Build(_ => Make.Json(HttpStatusCode.OK, TokenJson()));
        for (var i = 0; i < CspTokenProvider.MaxAddresses; i++)
        {
            Assert.NotNull(await provider.GetTokenAsync($"https://dfrntcrm.t{i}.deliverdifferent.com", CancellationToken.None));
        }

        Assert.Null(await provider.GetTokenAsync("https://dfrntcrm.extra.deliverdifferent.com", CancellationToken.None));
        Assert.Equal(CspTokenProvider.MaxAddresses, handler.Requests.Count);
        Assert.NotNull(await provider.GetTokenAsync("https://dfrntcrm.t0.deliverdifferent.com", CancellationToken.None));
    }

    [Fact]
    public async Task Each_csp_address_has_its_own_token_and_invalidate_forces_a_refetch()
    {
        var (provider, handler) = Build(_ => Make.Json(HttpStatusCode.OK, TokenJson()));

        await provider.GetTokenAsync(Csp, CancellationToken.None);
        await provider.GetTokenAsync("https://dfrntcrm.other.staging.deliverdifferent.com", CancellationToken.None);
        Assert.Equal(2, handler.Requests.Count);

        provider.Invalidate(Csp);
        await provider.GetTokenAsync(Csp, CancellationToken.None);
        Assert.Equal(3, handler.Requests.Count);
    }

    [Fact]
    public async Task Concurrent_callers_share_one_request()
    {
        var gate = new TaskCompletionSource();
        var handler = new GatedHandler(gate.Task, TokenJson());
        var provider = new CspTokenProvider(new SingleClientFactory(handler), new ServiceAuthOptions { AssertionPath = _file },
            Make.Production(), _time);

        var calls = Enumerable.Range(0, 5).Select(_ => provider.GetTokenAsync(Csp, CancellationToken.None)).ToList();
        gate.SetResult();
        var tokens = await Task.WhenAll(calls);

        Assert.All(tokens, t => Assert.Equal("csp-token", t));
        Assert.Equal(1, handler.Calls);
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, "{}")]
    [InlineData(HttpStatusCode.OK, "{\"access_token\":\"\",\"token_type\":\"Bearer\",\"expires_in\":60}")]
    [InlineData(HttpStatusCode.OK, "{\"access_token\":\"a\",\"token_type\":\"Basic\",\"expires_in\":60}")]
    [InlineData(HttpStatusCode.OK, "{\"access_token\":\"a\",\"token_type\":\"Bearer\",\"expires_in\":0}")]
    public async Task A_failed_exchange_is_a_null_token(HttpStatusCode status, string body)
    {
        var (provider, _) = Build(_ => Make.Json(status, body));

        Assert.Null(await provider.GetTokenAsync(Csp, CancellationToken.None));
    }

    [Fact]
    public async Task A_network_error_or_missing_file_is_a_null_token_and_not_configured()
    {
        var (down, _) = Build(_ => throw new HttpRequestException("refused"));
        Assert.Null(await down.GetTokenAsync(Csp, CancellationToken.None));

        var (noFile, handler) = Build(_ => Make.Json(HttpStatusCode.OK, TokenJson()), path: Path.Combine(Path.GetTempPath(), "nope"));
        Assert.False(noFile.IsConfigured);
        Assert.Null(await noFile.GetTokenAsync(Csp, CancellationToken.None));
        Assert.Empty(handler.Requests);
    }

    private sealed class GatedHandler(Task gate, string body) : HttpMessageHandler
    {
        private int _calls;
        public int Calls => _calls;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _calls);
            await gate;
            return Make.Json(HttpStatusCode.OK, body);
        }
    }
}
