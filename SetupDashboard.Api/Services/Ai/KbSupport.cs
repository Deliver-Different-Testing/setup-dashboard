namespace SetupDashboard.Services.Ai;

/// <summary>A knowledge-base article the answer drew on, shown under it as a badge.</summary>
public sealed record KbSource(Guid ArticleId, string Title, bool IsFaq);

/// <summary>The articles one question's tools turned up, so the answer's sources can be told from them.</summary>
public sealed class KbTurnSources
{
    private readonly List<KbSource> _seen = [];

    public IReadOnlyList<KbSource> Seen => _seen;

    public void Add(Guid articleId, string title, bool isFaq)
    {
        if (_seen.TrueForAll(s => s.ArticleId != articleId))
        {
            _seen.Add(new KbSource(articleId, title, isFaq));
        }
    }
}

internal static class KbText
{
    public const string UnavailableMessage =
        "The help knowledge base is unavailable right now. Answer from your own domain knowledge and say help articles couldn't be checked.";

    private const int ArticleLength = 6000;
    private const int LeadLength = 500;
    private const int MinLeadLength = 150;

    /// <summary>Article text goes into a prompt: angle brackets and control characters are dropped so it can't close a tag.</summary>
    public static string Clean(string? text) =>
        string.IsNullOrEmpty(text)
            ? string.Empty
            : new string(text.Select(c => c is '<' or '>' || (char.IsControl(c) && c is not ('\n' or '\r' or '\t')) ? ' ' : c).ToArray());

    public static string Article(string? text)
    {
        var flat = Clean(text).Trim();
        return flat.Length <= ArticleLength ? flat : flat[..ArticleLength] + "…";
    }

    public static string Lead(string? text)
    {
        var flat = Clean(text).Trim();
        var paragraphEnd = flat.IndexOf('\n');
        if (paragraphEnd > 0)
        {
            flat = flat[..paragraphEnd].TrimEnd();
        }

        if (flat.Length <= LeadLength)
        {
            return flat;
        }

        var window = flat[..LeadLength];
        var sentenceEnd = Math.Max(window.LastIndexOf(". ", StringComparison.Ordinal), window.LastIndexOf("? ", StringComparison.Ordinal));
        return sentenceEnd >= MinLeadLength ? window[..(sentenceEnd + 1)] : window + "…";
    }
}
