using System.Collections.Concurrent;
using SetupDashboard.Models;

namespace SetupDashboard.Services;

/// <summary>
/// In-memory session store. Production would use Redis or a database.
/// </summary>
public class SessionStore
{
    private readonly ConcurrentDictionary<string, SetupSession> _sessions = new();

    public SetupSession Create(string? environment = null)
    {
        var session = new SetupSession();
        if (!string.IsNullOrEmpty(environment))
            session.Environment = environment;
        _sessions[session.Id] = session;
        return session;
    }

    public SetupSession? Get(string id) => _sessions.TryGetValue(id, out var s) ? s : null;

    public SetupSession GetOrThrow(string id)
        => Get(id) ?? throw new KeyNotFoundException($"Session '{id}' not found");

    public List<SetupSession> List(string? status = null)
        => _sessions.Values
            .Where(s => status == null || s.Status == status)
            .OrderByDescending(s => s.UpdatedAt)
            .ToList();

    public void Update(SetupSession session)
    {
        session.UpdatedAt = DateTime.UtcNow;
        _sessions[session.Id] = session;
    }

    public bool Delete(string id) => _sessions.TryRemove(id, out _);
}
