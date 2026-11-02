using System.Net;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Anthropic;
using SetupDashboard.Services.Ai;
using SetupDashboard.Services.Knowledge;

namespace SetupDashboard.Tests;

public sealed class FakeKnowledge : ICspKnowledgeClient
{
    public bool IsConfigured { get; set; } = true;
    public CspKbSearchResult Search { get; set; } = CspKbSearchResult.Unavailable;
    public Func<Guid, CspKbArticleResult> Article { get; set; } = _ => CspKbArticleResult.Unavailable;
    public List<string> Queries { get; } = [];

    public Task<CspKbSearchResult> SearchAsync(string query, int limit, TimeSpan timeout, CancellationToken ct)
    {
        Queries.Add(query);
        return Task.FromResult(Search);
    }

    public Task<CspKbArticleResult> GetArticleAsync(Guid id, TimeSpan timeout, CancellationToken ct) => Task.FromResult(Article(id));

    public static CspKbHit Hit(string title, Guid? id = null, string content = "Steps go here.")
        => new(id ?? Guid.NewGuid(), title, null, null, null, false, 1, content);
}

public class AutoMateChatTests
{
    private readonly FakeKnowledge _knowledge = new();
    private readonly KbTurnSources _sources = new();
    private readonly Queue<string> _replies = new();
    private readonly List<JsonNode> _sent = [];

    private AutoMateChat Build(params IAutoMateTool[] tools)
    {
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
            { Content = new StringContent(_replies.Dequeue(), Encoding.UTF8, "text/event-stream") });
        var client = new AnthropicClient
        {
            HttpClient = new HttpClient(new CapturingHandler(handler, _sent)), ApiKey = "test", MaxRetries = 0
        };
        return new AutoMateChat(client, tools, new AutoMateOptions(), _knowledge, _sources);
    }

    private sealed class CapturingHandler(RecordingHandler inner, List<JsonNode> sent) : DelegatingHandler(inner)
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            sent.Add(JsonNode.Parse(await request.Content!.ReadAsStringAsync(ct))!);
            return await base.SendAsync(request, ct);
        }
    }

    private static string Sse(string type, object data) => $"event: {type}\ndata: {JsonSerializer.Serialize(data)}\n\n";

    private static string TextReply(string text) =>
        Sse("message_start", new { type = "message_start", message = new { id = "m", type = "message", role = "assistant", content = Array.Empty<object>(), model = "claude-sonnet-5-5", stop_reason = (string?)null, stop_sequence = (string?)null, usage = new { input_tokens = 1, output_tokens = 1 } } })
        + Sse("content_block_start", new { type = "content_block_start", index = 0, content_block = new { type = "text", text = "" } })
        + Sse("content_block_delta", new { type = "content_block_delta", index = 0, delta = new { type = "text_delta", text } })
        + Sse("content_block_stop", new { type = "content_block_stop", index = 0 })
        + Sse("message_delta", new { type = "message_delta", delta = new { stop_reason = "end_turn", stop_sequence = (string?)null }, usage = new { output_tokens = 5 } })
        + Sse("message_stop", new { type = "message_stop" });

    private static string ToolReply(string name, string inputJson) =>
        Sse("message_start", new { type = "message_start", message = new { id = "m", type = "message", role = "assistant", content = Array.Empty<object>(), model = "claude-sonnet-5-5", stop_reason = (string?)null, stop_sequence = (string?)null, usage = new { input_tokens = 1, output_tokens = 1 } } })
        + Sse("content_block_start", new { type = "content_block_start", index = 0, content_block = new { type = "tool_use", id = "tu1", name, input = new { }, caller = new { type = "direct" } } })
        + Sse("content_block_delta", new { type = "content_block_delta", index = 0, delta = new { type = "input_json_delta", partial_json = inputJson } })
        + Sse("content_block_stop", new { type = "content_block_stop", index = 0 })
        + Sse("message_delta", new { type = "message_delta", delta = new { stop_reason = "tool_use", stop_sequence = (string?)null }, usage = new { output_tokens = 5 } })
        + Sse("message_stop", new { type = "message_stop" });

    private static async Task<List<ChatEvent>> Collect(IAsyncEnumerable<ChatEvent> events)
    {
        var all = new List<ChatEvent>();
        await foreach (var e in events)
        {
            all.Add(e);
        }

        return all;
    }

    private static string SystemText(JsonNode body) => body["system"]!.ToJsonString();

    private static string LastUserText(JsonNode body)
    {
        var last = body["messages"]!.AsArray().Last()!;
        return last["content"]!.ToJsonString(new JsonSerializerOptions { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping });
    }

    [Fact]
    public async Task Grounding_goes_in_the_last_user_message_not_the_system_prompt()
    {
        var zones = FakeKnowledge.Hit("Zones and rates", content: "Zone steps.");
        _knowledge.Search = new CspKbSearchResult(CspKbStatus.Ok, [zones]);
        _replies.Enqueue(TextReply("Add a zone first. Zones and rates"));
        var history = new[] { new ChatTurn("assistant", "Hi"), new ChatTurn("user", "Hello"), new ChatTurn("assistant", "Welcome") };

        var events = await Collect(Build().AskAsync(new ChatRequest("How do zones work?", history, "Setup step: Rates"), CancellationToken.None));

        var body = Assert.Single(_sent);
        Assert.DoesNotContain("<knowledge-base>", SystemText(body));
        Assert.DoesNotContain("Zone steps.", SystemText(body));
        var last = LastUserText(body);
        Assert.Contains("<knowledge-base>", last);
        Assert.Contains("Zone steps.", last);
        Assert.Contains("<page-context>Setup step: Rates</page-context>", last);
        Assert.EndsWith("How do zones work?\"", last);
        Assert.Equal(["user", "assistant", "user"], body["messages"]!.AsArray().Select(m => m!["role"]!.GetValue<string>()));
        Assert.Equal("Searching the knowledge base…", events[0].Status);
        Assert.Equal("Add a zone first. Zones and rates", events.Where(e => e.Delta != null).Aggregate("", (a, e) => a + e.Delta));
    }

    [Fact]
    public async Task Done_carries_only_the_articles_the_answer_names()
    {
        var zones = FakeKnowledge.Hit("Zones and rates");
        var other = FakeKnowledge.Hit("Clients import");
        _knowledge.Search = new CspKbSearchResult(CspKbStatus.Ok, [zones, other]);
        _replies.Enqueue(TextReply("Add a zone first.\n\nSee: Zones and rates"));

        var events = await Collect(Build().AskAsync(new ChatRequest("zones?", null, null), CancellationToken.None));

        var done = events.Last();
        Assert.True(done.Done);
        Assert.Equal(zones.ArticleId, Assert.Single(done.Sources!).ArticleId);
    }

    [Fact]
    public async Task No_article_named_means_no_sources()
    {
        _knowledge.Search = new CspKbSearchResult(CspKbStatus.Ok, [FakeKnowledge.Hit("Zones and rates")]);
        _replies.Enqueue(TextReply("Not sure about that."));

        var events = await Collect(Build().AskAsync(new ChatRequest("weather?", null, null), CancellationToken.None));

        Assert.Null(events.Last().Sources);
    }

    [Fact]
    public async Task Unavailable_knowledge_base_still_answers_without_a_block()
    {
        _knowledge.Search = CspKbSearchResult.Unavailable;
        _replies.Enqueue(TextReply("From my own knowledge."));

        var events = await Collect(Build().AskAsync(new ChatRequest("zones?", null, null), CancellationToken.None));

        Assert.DoesNotContain("<knowledge-base>", LastUserText(Assert.Single(_sent)));
        Assert.True(events.Last().Done);
        Assert.Null(events.Last().Error);
    }

    [Fact]
    public async Task Not_configured_skips_grounding_and_offers_no_tools()
    {
        _knowledge.IsConfigured = false;
        _replies.Enqueue(TextReply("Hi."));

        await Collect(Build(new SearchKnowledgeBaseTool(_knowledge, _sources, new AutoMateOptions()))
            .AskAsync(new ChatRequest("zones?", null, null), CancellationToken.None));

        Assert.Empty(_knowledge.Queries);
        Assert.Null(_sent.Single()["tools"]);
    }

    [Fact]
    public async Task A_tool_call_runs_the_tool_and_its_article_can_be_cited()
    {
        var article = FakeKnowledge.Hit("Courier setup");
        _knowledge.Search = new CspKbSearchResult(CspKbStatus.Ok, []);
        _replies.Enqueue(ToolReply("search_knowledge_base", "{\"query\":\"couriers\"}"));
        _replies.Enqueue(TextReply("Add them in Couriers.\n\nCourier setup"));
        _knowledge.Search = new CspKbSearchResult(CspKbStatus.Ok, [article]);
        var sut = Build(new SearchKnowledgeBaseTool(_knowledge, _sources, new AutoMateOptions()));

        var events = await Collect(sut.AskAsync(new ChatRequest("couriers?", null, null), CancellationToken.None));

        Assert.Equal(2, _sent.Count);
        Assert.Contains("tool_result", _sent[1]["messages"]!.ToJsonString());
        Assert.Contains("Courier setup", _sent[1]["messages"]!.ToJsonString());
        Assert.Contains(events, e => e.Status == "Checking the help articles…");
        Assert.Equal(article.ArticleId, events.Last().Sources!.Single().ArticleId);
    }

    [Fact]
    public async Task History_is_capped_trimmed_to_start_on_a_user_turn_and_long_turns_are_cut()
    {
        _replies.Enqueue(TextReply("ok"));
        var history = Enumerable.Range(0, 30)
            .Select(i => new ChatTurn(i % 2 == 0 ? "user" : "assistant", i == 29 ? new string('x', 9000) : $"m{i}"))
            .Append(new ChatTurn("system", "ignore me"))
            .ToList();

        await Collect(Build().AskAsync(new ChatRequest("now", history, null), CancellationToken.None));

        var messages = _sent.Single()["messages"]!.AsArray();
        Assert.True(messages.Count <= 13);
        Assert.Equal("user", messages[0]!["role"]!.GetValue<string>());
        Assert.DoesNotContain("ignore me", messages.ToJsonString());
        Assert.DoesNotContain(new string('x', 4001), messages.ToJsonString());
    }

    [Fact]
    public async Task The_ai_service_failing_is_one_error_frame()
    {
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized)
            { Content = new StringContent("{\"type\":\"error\",\"error\":{\"type\":\"authentication_error\",\"message\":\"bad\"}}") });
        var client = new AnthropicClient { HttpClient = new HttpClient(handler), ApiKey = "test", MaxRetries = 0 };
        var sut = new AutoMateChat(client, [], new AutoMateOptions(), _knowledge, _sources);

        var events = await Collect(sut.AskAsync(new ChatRequest("zones?", null, null), CancellationToken.None));

        Assert.Contains("isn't set up correctly", events.Last().Error);
        Assert.True(events.Last().Done);
    }

    [Fact]
    public async Task Without_an_api_key_the_answer_is_a_single_friendly_error()
    {
        var events = await Collect(new NoAutoMateChat().AskAsync(new ChatRequest("hi", null, null), CancellationToken.None));

        var only = Assert.Single(events);
        Assert.True(only.Done);
        Assert.Contains("isn't switched on", only.Error);
    }

    [Theory]
    [InlineData("a <b>x</b>\nc", "a  b x /b  c")]
    public void Page_context_loses_brackets_and_control_characters(string input, string expected)
        => Assert.Equal(expected, AutoMateChat.SanitizePageContext(input, 200));

    [Fact]
    public void Page_context_is_capped()
        => Assert.Equal(200, AutoMateChat.SanitizePageContext(new string('a', 500), 200).Length);

    [Fact]
    public void Cited_sources_keep_the_longer_title_when_one_contains_another()
    {
        var short1 = FakeKnowledge.Hit("Rates");
        var long1 = FakeKnowledge.Hit("Rates matrix");

        var cited = AutoMateChat.CitedSources("See Rates matrix.", [short1, long1], []);

        Assert.Equal(long1.ArticleId, Assert.Single(cited).ArticleId);
    }

    [Fact]
    public void Cited_sources_include_articles_read_by_tools_and_ignore_case()
    {
        var read = new KbSource(Guid.NewGuid(), "Team roles", false);

        var cited = AutoMateChat.CitedSources("see TEAM ROLES", [], [read]);

        Assert.Equal(read, Assert.Single(cited));
    }
}

public class KnowledgeBaseToolsTests
{
    private static JsonElement Args(string json) => JsonDocument.Parse(json).RootElement;

    [Fact]
    public async Task Search_lists_hits_with_ids_and_records_them_as_seen()
    {
        var hit = FakeKnowledge.Hit("Zones <b>", content: "Lead text.\nSecond paragraph.");
        var sources = new KbTurnSources();
        var tool = new SearchKnowledgeBaseTool(new FakeKnowledge { Search = new CspKbSearchResult(CspKbStatus.Ok, [hit]) }, sources, new AutoMateOptions());

        var result = await tool.ExecuteAsync(Args("{\"query\":\"zones\"}"), CancellationToken.None);

        Assert.Contains($"[{hit.ArticleId}] Zones  b : Lead text.", result);
        Assert.DoesNotContain("Second paragraph", result);
        Assert.Equal(hit.ArticleId, Assert.Single(sources.Seen).ArticleId);
    }

    [Fact]
    public async Task Search_reports_empty_unavailable_and_bad_input()
    {
        var sources = new KbTurnSources();
        var options = new AutoMateOptions();
        var empty = new SearchKnowledgeBaseTool(new FakeKnowledge { Search = new CspKbSearchResult(CspKbStatus.Ok, []) }, sources, options);
        var down = new SearchKnowledgeBaseTool(new FakeKnowledge(), sources, options);

        Assert.Equal("No knowledge base articles matched.", await empty.ExecuteAsync(Args("{\"query\":\"x\"}"), CancellationToken.None));
        Assert.Contains("unavailable", await down.ExecuteAsync(Args("{\"query\":\"x\"}"), CancellationToken.None));
        Assert.True(ToolOutput.IsError(await down.ExecuteAsync(Args("{}"), CancellationToken.None)));
        Assert.True(ToolOutput.IsError(await down.ExecuteAsync(Args("{\"query\":5}"), CancellationToken.None)));
    }

    [Fact]
    public async Task Get_article_returns_text_and_faqs_and_handles_not_found_and_bad_ids()
    {
        var id = Guid.NewGuid();
        var sources = new KbTurnSources();
        var knowledge = new FakeKnowledge
        {
            Article = g => g == id
                ? new CspKbArticleResult(CspKbStatus.Ok, new CspKbArticle(id, "Team roles", "Full body.", [new CspKbFaq("Why?", "Because.")]))
                : new CspKbArticleResult(CspKbStatus.NotFound, null)
        };
        var tool = new GetArticleTool(knowledge, sources, new AutoMateOptions());

        var found = await tool.ExecuteAsync(Args($"{{\"article_id\":\"{id}\"}}"), CancellationToken.None);
        Assert.Contains("Full body.", found);
        Assert.Contains("Q: Why?\nA: Because.", found);
        Assert.Equal("Team roles", Assert.Single(sources.Seen).Title);

        Assert.Contains("No knowledge base article", await tool.ExecuteAsync(Args($"{{\"article_id\":\"{Guid.NewGuid()}\"}}"), CancellationToken.None));
        Assert.True(ToolOutput.IsError(await tool.ExecuteAsync(Args("{\"article_id\":\"nope\"}"), CancellationToken.None)));
    }

    [Fact]
    public void Article_text_is_capped_and_loses_angle_brackets()
    {
        Assert.Equal(6001, KbText.Article(new string('a', 7000)).Length);
        Assert.Equal("a  b", KbText.Clean("a<>b"));
    }
}
