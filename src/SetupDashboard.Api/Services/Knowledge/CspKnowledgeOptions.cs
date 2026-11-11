namespace SetupDashboard.Services.Knowledge;

/// <summary>Where the CSP Knowledge API is and what of it Auto-Mate may use; override under <c>CspKnowledge</c>.</summary>
public sealed class CspKnowledgeOptions
{
    public const string SectionName = "CspKnowledge";

    /// <summary>
    /// CSP's address, e.g. <c>http://localhost:5310</c> locally. When empty it is <c>dfrntcrm.</c> on this pod's own
    /// tenant domain; never the address the request came in on, because the call carries this app's credentials.
    /// </summary>
    public string? BaseUrl { get; set; }

    /// <summary>
    /// The article layers shown to Auto-Mate. Clients use the dashboard too, so tenant-internal articles are left out
    /// here as well as by CSP's registration scopes. A hit with no layer is dropped.
    /// </summary>
    public string[] AllowedLayers { get; set; } = ["shipped", "client"];
}
