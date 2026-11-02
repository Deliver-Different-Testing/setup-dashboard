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
    internal const int MaxAddresses = 8;
    internal static readonly TimeSpan TransientBreak = TimeSpan.FromSeconds(30);
    internal static readonly TimeSpan PermanentBreak = TimeSpan.FromMinutes(5);

    private readonly TimeProvider _time = timeProvider ?? TimeProvider.System;
    private readonly ConcurrentDictionary<string, Breaker> _breakers = new();

    public bool IsOpen(string baseUrl)
    {
        // Past the bound a new address is treated as broken rather than given a breaker of its own.
        if (Of(baseUrl) is not { } breaker)
        {
            return true;
        }

        lock (breaker)
        {
            return _time.GetUtcNow() < breaker.OpenUntil;
        }
    }

    public void RecordSuccess(string baseUrl)
    {
        if (Of(baseUrl) is not { } breaker)
        {
            return;
        }

        lock (breaker)
        {
            breaker.ConsecutiveFailures = 0;
            breaker.OpenUntil = DateTimeOffset.MinValue;
        }
    }

    public void RecordFailure(string baseUrl, string reason, bool permanent)
    {
        if (Of(baseUrl) is not { } breaker)
        {
            return;
        }

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

    /// <summary>The address's breaker, or null for a new address once <see cref="MaxAddresses"/> exist (a pod talks to one CSP).</summary>
    private Breaker? Of(string baseUrl)
    {
        var key = baseUrl.TrimEnd('/');
        if (_breakers.TryGetValue(key, out var breaker))
        {
            return breaker;
        }

        return _breakers.Count >= MaxAddresses ? null : _breakers.GetOrAdd(key, _ => new Breaker());
    }

    private sealed class Breaker
    {
        public int ConsecutiveFailures { get; set; }
        public DateTimeOffset OpenUntil { get; set; } = DateTimeOffset.MinValue;
    }
}
