using System.Collections.Concurrent;
using Serilog;

namespace SetupDashboard.Services.Knowledge;

/// <summary>
/// Stops asking a CSP that isn't answering, one breaker per CSP address. A failure that won't clear by retrying
/// (no API at that address, bad key) opens it at once; a transient one opens it after repeated failures, and a
/// probe that fails after the break reopens it. The warning is logged when it opens, so a dead CSP costs one
/// line per break rather than one per message.
/// </summary>
public sealed class CspKnowledgeCircuit(TimeProvider? timeProvider = null)
{
    internal const int TransientFailureThreshold = 3;
    internal static readonly TimeSpan TransientBreak = TimeSpan.FromSeconds(30);
    internal static readonly TimeSpan PermanentBreak = TimeSpan.FromMinutes(5);

    private readonly TimeProvider _time = timeProvider ?? TimeProvider.System;
    private readonly ConcurrentDictionary<string, Breaker> _breakers = new();

    public bool IsOpen(string baseUrl)
    {
        var breaker = Of(baseUrl);
        lock (breaker)
        {
            return _time.GetUtcNow() < breaker.OpenUntil;
        }
    }

    public void RecordSuccess(string baseUrl)
    {
        var breaker = Of(baseUrl);
        lock (breaker)
        {
            breaker.ConsecutiveFailures = 0;
            breaker.OpenUntil = DateTimeOffset.MinValue;
        }
    }

    public void RecordFailure(string baseUrl, string reason, bool permanent)
    {
        var breaker = Of(baseUrl);
        TimeSpan? opened = null;
        lock (breaker)
        {
            breaker.ConsecutiveFailures++;
            if (permanent || breaker.ConsecutiveFailures >= TransientFailureThreshold)
            {
                opened = permanent ? PermanentBreak : TransientBreak;
                breaker.OpenUntil = _time.GetUtcNow() + opened.Value;
            }
        }

        if (opened is { } span)
        {
            Log.Warning("CSP knowledge base unavailable ({Reason}); skipping it for {Seconds}s", reason, (int)span.TotalSeconds);
        }
        else
        {
            Log.Debug("CSP knowledge base call failed ({Reason})", reason);
        }
    }

    private Breaker Of(string baseUrl) => _breakers.GetOrAdd(baseUrl.TrimEnd('/'), _ => new Breaker());

    private sealed class Breaker
    {
        public int ConsecutiveFailures { get; set; }
        public DateTimeOffset OpenUntil { get; set; } = DateTimeOffset.MinValue;
    }
}
