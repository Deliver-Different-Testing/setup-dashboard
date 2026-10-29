using SetupDashboard.Models;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Services.Steps;

/// <summary>
/// Per-record outcomes on a step, keyed by kind + natural key (code, email, name).
/// Re-running a push skips rows already created instead of re-posting them - the old
/// dashboard skipped "the first N rows", so one failure shifted every later row.
/// </summary>
public sealed class RowLedger(StepState step)
{
    public RowResult Row(string kind, string key)
    {
        var norm = Normalise(key);
        var row = step.Rows.FirstOrDefault(r => r.Kind == kind && Normalise(r.Key) == norm);
        if (row == null)
        {
            row = new RowResult { Kind = kind, Key = key.Trim() };
            step.Rows.Add(row);
        }
        return row;
    }

    public bool AlreadyCreated(string kind, string key, out int? entityId)
    {
        var norm = Normalise(key);
        var row = step.Rows.FirstOrDefault(r => r.Kind == kind && Normalise(r.Key) == norm && r.Status == RowStatus.Created);
        entityId = row?.EntityId;
        return row != null;
    }

    public int? IdOf(string kind, string? key)
    {
        if (string.IsNullOrWhiteSpace(key)) return null;
        var norm = Normalise(key);
        return step.Rows.FirstOrDefault(r => r.Kind == kind && Normalise(r.Key) == norm && r.Status == RowStatus.Created)?.EntityId;
    }

    public List<int> CreatedIds(string kind, Func<string, bool> keyMatches)
        => step.Rows.Where(r => r.Kind == kind && r.Status == RowStatus.Created && r.EntityId != null && keyMatches(r.Key))
            .Select(r => r.EntityId!.Value).Distinct().ToList();

    /// <summary>Sent before with no answer back. Left alone until someone checks the target app and chooses Send again.</summary>
    public bool IsUnknown(string kind, string key)
    {
        var norm = Normalise(key);
        return step.Rows.Any(r => r.Kind == kind && Normalise(r.Key) == norm && r.Status == RowStatus.Unknown);
    }

    /// <summary>Lets an unknown row be sent again, once a person has checked it isn't in the target app.</summary>
    public static bool Retry(StepState step, string kind, string key)
    {
        var norm = Normalise(key);
        var row = step.Rows.FirstOrDefault(r => r.Kind == kind && Normalise(r.Key) == norm && r.Status == RowStatus.Unknown);
        if (row == null) return false;
        row.Status = RowStatus.Failed;
        row.UpdatedAt = DateTime.UtcNow;
        return true;
    }

    /// <summary>
    /// Drops rows a push didn't touch and that never reached the target app - left behind when a
    /// record's code, email or name was edited. Created and unknown rows are always kept.
    /// </summary>
    public static void PruneStale(StepState step, DateTime pushStarted)
        => step.Rows.RemoveAll(r => r.UpdatedAt < pushStarted
                                    && r.Status is RowStatus.Pending or RowStatus.NeedsData or RowStatus.Failed);

    public static void NeedsData(RowResult row, IEnumerable<string> needs)
    {
        row.Status = RowStatus.NeedsData;
        row.Needs = needs.ToList();
        row.Errors.Clear();
        row.UpdatedAt = DateTime.UtcNow;
    }

    public static void Created(RowResult row, int? id, string? notice = null)
    {
        row.Status = RowStatus.Created;
        row.EntityId = id;
        row.Needs.Clear();
        row.Errors.Clear();
        row.Notice = notice;
        row.UpdatedAt = DateTime.UtcNow;
    }

    public static void Failed(RowResult row, ApiResult result)
    {
        row.Status = result.MayHaveSaved ? RowStatus.Unknown : RowStatus.Failed;
        row.Needs.Clear();
        row.Errors = result.Messages.Count > 0 ? result.Messages.ToList() : [$"Failed ({result.Status})."];
        row.UpdatedAt = DateTime.UtcNow;
    }

    public static void Failed(RowResult row, string message)
    {
        row.Status = RowStatus.Failed;
        row.Needs.Clear();
        row.Errors = [message];
        row.UpdatedAt = DateTime.UtcNow;
    }

    public static string Normalise(string key) => key.Trim().ToLowerInvariant();
}

/// <summary>Builds the "needs: ..." list for a row.</summary>
public sealed class Needs
{
    private readonly List<string> _items = new();

    public Needs Text(string? value, string label)
    {
        if (string.IsNullOrWhiteSpace(value)) _items.Add(label);
        return this;
    }

    public Needs Value<T>(T? value, string label) where T : struct
    {
        if (value == null) _items.Add(label);
        return this;
    }

    public Needs When(bool missing, string label)
    {
        if (missing) _items.Add(label);
        return this;
    }

    public bool Any => _items.Count > 0;
    public IReadOnlyList<string> Items => _items;
}
