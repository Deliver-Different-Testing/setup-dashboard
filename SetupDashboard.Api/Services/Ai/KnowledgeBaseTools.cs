using System.Text;
using System.Text.Json;
using Anthropic.Models.Beta.Messages;
using SetupDashboard.Services.Knowledge;

namespace SetupDashboard.Services.Ai;

/// <summary>A read-only tool Auto-Mate can call while answering.</summary>
public interface IAutoMateTool
{
    BetaTool Definition { get; }

    /// <summary>The text handed back to the model; an error is <c>{"error": ...}</c>.</summary>
    Task<string> ExecuteAsync(JsonElement input, CancellationToken ct);
}

internal static class ToolOutput
{
    public static string Error(string message) => JsonSerializer.Serialize(new { error = message });

    public static bool IsError(string result) => result.StartsWith("{\"error\":", StringComparison.Ordinal);

    public static string Truncate(string value, int maxChars) =>
        value.Length <= maxChars ? value : $"{value[..maxChars]}…[truncated {value.Length - maxChars} chars]";

    public static JsonElement Prop(string type, string description) => JsonSerializer.SerializeToElement(new { type, description });

    /// <summary>A string argument the model supplied, or null with <paramref name="error"/> set when it is missing or the wrong type.</summary>
    public static string? StringArg(JsonElement input, string name, out string? error)
    {
        error = null;
        if (input.ValueKind != JsonValueKind.Object || !input.TryGetProperty(name, out var element) || element.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        if (element.ValueKind == JsonValueKind.String)
        {
            return element.GetString();
        }

        error = $"Argument '{name}' must be a string.";
        return null;
    }
}

public sealed class SearchKnowledgeBaseTool(ICspKnowledgeClient client, KbTurnSources sources, AutoMateOptions options) : IAutoMateTool
{
    private const int SearchLimit = 5;

    private static readonly BetaTool Tool = new()
    {
        Name = "search_knowledge_base",
        Description = "Search the DFRNT knowledge base of help articles and FAQs. Use it for how-to and product questions, or to look again with different words when the supplied knowledge-base block did not cover the question. Each result has its article id in square brackets; call get_article with that id to read a whole article.",
        InputSchema = new InputSchema
        {
            Properties = new Dictionary<string, JsonElement>
            {
                ["query"] = ToolOutput.Prop("string", "What to search for, in plain words")
            },
            Required = ["query"]
        }
    };

    public BetaTool Definition => Tool;

    public async Task<string> ExecuteAsync(JsonElement input, CancellationToken ct)
    {
        var query = ToolOutput.StringArg(input, "query", out var error);
        if (error is not null || string.IsNullOrWhiteSpace(query))
        {
            return ToolOutput.Error(error ?? "'query' is required and must be non-empty text.");
        }

        var result = await client.SearchAsync(query.Trim(), SearchLimit, TimeSpan.FromMilliseconds(options.KbToolTimeoutMs), ct);
        if (result.Status == CspKbStatus.Unavailable)
        {
            return ToolOutput.Error(KbText.UnavailableMessage);
        }

        if (result.Hits.Count == 0)
        {
            return "No knowledge base articles matched.";
        }

        var sb = new StringBuilder("<kb-result>");
        foreach (var hit in result.Hits)
        {
            sources.Add(hit.ArticleId, hit.Title, hit.IsFaq);
            sb.Append("\n- [").Append(hit.ArticleId).Append("] ").Append(KbText.Clean(hit.Title)).Append(": ")
                .Append(KbText.Lead(hit.Content ?? hit.Snippet));
        }

        return sb.Append("\n</kb-result>").ToString();
    }
}

public sealed class GetArticleTool(ICspKnowledgeClient client, KbTurnSources sources, AutoMateOptions options) : IAutoMateTool
{
    private static readonly BetaTool Tool = new()
    {
        Name = "get_article",
        Description = "Read one knowledge base article in full, including its FAQs. Use it when the lead of an article in the knowledge-base block or in search results does not give the steps.",
        InputSchema = new InputSchema
        {
            Properties = new Dictionary<string, JsonElement>
            {
                ["article_id"] = ToolOutput.Prop("string", "The article GUID shown in square brackets")
            },
            Required = ["article_id"]
        }
    };

    public BetaTool Definition => Tool;

    public async Task<string> ExecuteAsync(JsonElement input, CancellationToken ct)
    {
        var raw = ToolOutput.StringArg(input, "article_id", out var error);
        if (error is not null || !Guid.TryParse(raw, out var id))
        {
            return ToolOutput.Error(error ?? "'article_id' is required and must be the GUID shown in square brackets.");
        }

        var result = await client.GetArticleAsync(id, TimeSpan.FromMilliseconds(options.KbToolTimeoutMs), ct);
        if (result.Status == CspKbStatus.Unavailable)
        {
            return ToolOutput.Error(KbText.UnavailableMessage);
        }

        if (result.Article is not { } article)
        {
            return ToolOutput.Error("No knowledge base article has that id.");
        }

        sources.Add(id, article.Title, isFaq: false);

        var sb = new StringBuilder("<kb-result>\n")
            .Append(KbText.Clean(article.Title)).Append('\n').Append(KbText.Article(article.Content));
        foreach (var faq in article.Faqs ?? [])
        {
            sb.Append("\n\nQ: ").Append(KbText.Clean(faq.Question)).Append("\nA: ").Append(KbText.Clean(faq.Answer));
        }

        return sb.Append("\n</kb-result>").ToString();
    }
}
