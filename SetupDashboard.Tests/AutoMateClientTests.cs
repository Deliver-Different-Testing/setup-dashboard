using System.Net;
using System.Text;
using Microsoft.Extensions.Configuration;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Tests;

public class AutoMateClientTests
{
    private const string Csp = "https://dfrntcrm.cheetah.staging.deliverdifferent.com";

    private static (AutoMateClient Client, RecordingHandler Handler) Build(Func<HttpRequestMessage, HttpResponseMessage> respond,
        bool cspListed = true)
    {
        var settings = new Dictionary<string, string?> { ["TenantApps:Hosts:Settings"] = "dfrntdriveconfig" };
        if (cspListed)
        {
            settings["TenantApps:Hosts:Csp"] = "dfrntcrm";
        }

        var handler = new RecordingHandler(respond);
        var http = Make.Http(Make.User(), ".AspNet.SharedCookie=abc; hub_session=zzz");
        var client = new AutoMateClient(new SingleClientFactory(handler), http,
            new TenantAppUrls(new ConfigurationBuilder().AddInMemoryCollection(settings).Build(), http, Make.Production()));
        return (client, handler);
    }

    private static HttpResponseMessage Sse(string frames)
        => new(HttpStatusCode.OK) { Content = new StringContent(frames, Encoding.UTF8, "text/event-stream") };

    [Fact]
    public async Task Asks_csp_as_the_signed_in_person_with_only_the_question_and_session()
    {
        var session = Guid.NewGuid();
        var (client, handler) = Build(_ => Sse("data: {\"delta\":\"Hi\"}\n\n"));

        using var reply = await client.AskAsync("How do zones work?", session);

        Assert.True(reply.Ok);
        var post = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Post, post.Method);
        Assert.Equal($"{Csp}/api/v1/chat/messages", post.RequestUri!.ToString());
        Assert.Equal(".AspNet.SharedCookie=abc", post.Headers.GetValues("Cookie").Single());
        Assert.Equal($"{{\"message\":\"How do zones work?\",\"sessionId\":\"{session}\"}}", handler.Bodies.Single());
        Assert.Equal("data: {\"delta\":\"Hi\"}\n\n", await new StreamReader(reply.Body!).ReadToEndAsync());
    }

    [Fact]
    public async Task Csp_off_the_app_list_means_auto_mate_is_not_set_up_here()
    {
        var (client, handler) = Build(_ => Sse(""), cspListed: false);

        using var reply = await client.AskAsync("Hi", null);

        Assert.False(reply.Ok);
        Assert.Empty(handler.Requests);
        Assert.Contains("isn't set up", reply.Error);
    }

    [Theory]
    [InlineData(HttpStatusCode.Redirect, "sign-in has expired")]
    [InlineData(HttpStatusCode.Unauthorized, "can't use Auto-Mate")]
    [InlineData(HttpStatusCode.Forbidden, "can't use Auto-Mate")]
    [InlineData(HttpStatusCode.TooManyRequests, "asking too quickly")]
    [InlineData(HttpStatusCode.InternalServerError, "couldn't answer")]
    public async Task Csp_refusing_before_the_stream_starts_becomes_a_plain_message(HttpStatusCode status, string expected)
    {
        var (client, _) = Build(_ => new HttpResponseMessage(status));

        using var reply = await client.AskAsync("Hi", null);

        Assert.False(reply.Ok);
        Assert.Contains(expected, reply.Error);
    }

    [Fact]
    public async Task An_html_page_instead_of_a_stream_is_the_sign_in_page()
    {
        var (client, _) = Build(_ => new HttpResponseMessage(HttpStatusCode.OK)
            { Content = new StringContent("<html></html>", Encoding.UTF8, "text/html") });

        using var reply = await client.AskAsync("Hi", null);

        Assert.False(reply.Ok);
        Assert.Contains("sign-in has expired", reply.Error);
    }

    [Fact]
    public async Task Csp_unreachable_becomes_a_plain_message()
    {
        var (client, _) = Build(_ => throw new HttpRequestException("refused"));

        using var reply = await client.AskAsync("Hi", null);

        Assert.False(reply.Ok);
        Assert.Contains("couldn't reach", reply.Error);
    }
}
