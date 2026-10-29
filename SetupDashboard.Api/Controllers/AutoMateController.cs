using System.Text;
using System.Text.Json;
using DeliverDifferent.AccessControl.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Serilog;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Controllers;

/// <summary>
/// The Auto-Mate sidebar's questions, answered by the Customer Success Platform. The answer is CSP's
/// Server-Sent Events stream passed through as it arrives (<c>data: {json}</c> frames with <c>delta</c>,
/// <c>status</c>, <c>error</c>, and a last frame with <c>done: true</c>). When CSP can't be asked, the
/// stream is a single error frame, so the browser handles one shape either way.
/// </summary>
[Authorize]
[RequireFeature(FeatureKeys.SetupDashboard)]
[ApiController]
[Route("api/setup/automate")]
public class AutoMateController(IAutoMateClient autoMate) : ControllerBase
{
    /// <summary>Same cap as CSP's, checked here so an over-long question never leaves the dashboard.</summary>
    private const int MaxMessageChars = 4000;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public sealed record AskRequest(string? Message, Guid? SessionId);

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
            await WriteErrorAsync(message.Length == 0
                ? "Type a question first."
                : $"That question is too long - please keep it under {MaxMessageChars:N0} characters.", ct);
            return;
        }

        using var reply = await autoMate.AskAsync(message, req.SessionId, ct);
        if (!reply.Ok)
        {
            await WriteErrorAsync(reply.Error!, ct);
            return;
        }

        var buffer = new byte[4096];
        try
        {
            int read;
            while ((read = await reply.Body!.ReadAsync(buffer, ct)) > 0)
            {
                await Response.Body.WriteAsync(buffer.AsMemory(0, read), ct);
                await Response.Body.FlushAsync(ct);
            }
        }
        // CSP dropped the connection part-way: the status code is spent, so end with an error frame
        // rather than a stream that just stops.
        catch (Exception ex) when (ex is IOException or HttpRequestException && !ct.IsCancellationRequested)
        {
            Log.Warning(ex, "Auto-Mate (CSP) stream ended part-way through the answer");
            await WriteErrorAsync("The answer was cut off. Please try again.", ct);
        }
    }

    private async Task WriteErrorAsync(string error, CancellationToken ct)
    {
        var frame = "data: " + JsonSerializer.Serialize(new { error, done = true }, Json) + "\n\n";
        await Response.Body.WriteAsync(Encoding.UTF8.GetBytes(frame), ct);
    }
}
