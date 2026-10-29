namespace SetupDashboard.Services.TenantApps;

/// <summary>
/// Auto-Mate's answers come from the Customer Success Platform (dfrntcrm): its Knowledge Base, which holds the
/// shipped Setup Dashboard help articles, and its chat, which streams the answer as Server-Sent Events. This asks
/// CSP's <c>POST /api/v1/chat/messages</c> as the signed-in person (Hub cookie forwarded server-side, as for the
/// other tenant apps) and hands back the open event stream.
/// </summary>
/// <remarks>
/// Only the question and CSP's session id are sent - never a company id, which would pull a client's health
/// into the answer. CSP owns the sessions, the model, the API key and the rate limit; it keeps sessions per
/// staff member, so a caller without a staff id gets a 401 from it.
/// </remarks>
public interface IAutoMateClient
{
    Task<AutoMateReply> AskAsync(string message, Guid? sessionId, CancellationToken ct = default);
}