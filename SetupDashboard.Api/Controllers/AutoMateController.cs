using System.Text;
using System.Text.Json;
using DeliverDifferent.AccessControl.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Serilog;
using SetupDashboard.Services.Ai;

namespace SetupDashboard.Controllers;

/// <summary>
/// The Auto-Mate sidebar's questions, answered by Claude from the CSP Knowledge Base. The answer is a
/// Server-Sent Events stream (<c>data: {json}</c> frames with <c>delta</c>, <c>status</c>, <c>error</c>, and a
/// last frame with <c>done: true</c> that may carry the article <c>sources</c>). When it can't be answered, the
/// stream is a single error frame, so the browser handles one shape either way.
/// </summary>
[Authorize]
[RequireFeature(FeatureKeys.SetupDashboard)]
[ApiController]
[Route("api/setup/automate")]
public class AutoMateController(IAutoMateChat chat) : ControllerBase
{
    private const int MaxMessageChars = 4000;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public sealed record AskRequest(string? Message, List<ChatTurn>? History, string? PageContext);

    [HttpPost("messages")]
    public async Task Ask([FromBody] AskRequest req, CancellationToken ct)
    {
        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        // Neither a proxy nor Kestrel may buffer the stream, or the answer arrives all at once.
        Response.Headers["X-Accel-Buffering"] = "no";
        HttpContext.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

        var message = req.Message?.Trim() ?? string.Empty;
        if (message.Length is 0 or > MaxMessageChars)
        {
            await WriteAsync(new ChatEvent(Error: message.Length == 0
                ? "Type a question first."
                : $"That question is too long - please keep it under {MaxMessageChars:N0} characters.", Done: true), ct);
            return;
        }

        try
        {
            await foreach (var evt in chat.AskAsync(new ChatRequest(message, req.History, req.PageContext), ct))
            {
                await WriteAsync(evt, ct);
            }
        }
        // The status code is spent once the stream starts: end with an error frame rather than a stream that just stops.
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            Log.Error(ex, "Auto-Mate answer failed part-way through");
            await WriteAsync(new ChatEvent(Error: "The answer was cut off. Please try again.", Done: true), ct);
        }
    }

    private async Task WriteAsync(ChatEvent evt, CancellationToken ct)
    {
        var frame = "data: " + JsonSerializer.Serialize(evt, Json) + "\n\n";
        await Response.Body.WriteAsync(Encoding.UTF8.GetBytes(frame), ct);
        await Response.Body.FlushAsync(ct);
    }
}
