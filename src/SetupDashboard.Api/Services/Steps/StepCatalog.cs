using SetupDashboard.Models;

namespace SetupDashboard.Services.Steps;

/// <summary>
/// The checklist each step starts with: work that no API can do yet (gaps G1-G12 in
/// docs/REWRITE-DESIGN-2026-10-24.md) or that belongs on another app's own screens.
/// A person ticks these; nothing here is done automatically.
/// </summary>
public static class StepCatalog
{
    public const string TenantIdentity = "tenant-identity";
    public const string TenantIdentitySeed = "tenant-identity-seed";
    private const string TenantClientFile = "tenant-client-file";
    public const string Depots = "depots";

    private static IReadOnlyList<ChecklistItem> Defaults(string stepKey, Func<string, string?> link) => stepKey switch
    {
        StepKeys.Business =>
        [
            new ChecklistItem { Id = TenantClientFile, Required = true, Owner = "DFRNT",
                Item = "Tenant's own client file exists (client type Tenant). Staff and roles hang off it; there is no API to create it yet." },
            new ChecklistItem { Id = TenantIdentitySeed, Owner = "DFRNT",
                Item = "Tenant seed ran: System Settings cleared of Urgent's details (address, logos, Internet Root, reply-from addresses) and the notification templates reworded for this tenant.",
                Link = link("adminmanager") is { } am0 ? $"{am0}/#/setting/1" : null },
            new ChecklistItem { Id = TenantIdentity, Required = true, Owner = "DFRNT",
                Item = "What the tenant seed leaves: Forgot Password / Hub invite wording, Email Settings reply-to, System Name (not 'Despatch Manager'), CountryCode, GST rate, Internet Booker. Check before anyone is invited.",
                Link = link("adminmanager") is { } am ? $"{am}/#/setting/1" : null },
            new ChecklistItem { Id = Depots, Required = true, Owner = "DFRNT",
                Item = "Depots created (needed by schedules, distance rates and fleets). Admin Manager only for now." },
            new ChecklistItem { Id = "logo", Owner = "DFRNT", Item = "Tenant logo uploaded (no upload API yet)." }
        ],
        StepKeys.Team =>
        [
            new ChecklistItem { Id = "role-actions", Owner = "DFRNT",
                Item = "Role actions reviewed (View Financial Data, Manage Users, Edit Settings...). They follow each tile unless switched off; DF Admin sets them in Settings > Roles.",
                Link = link("dfrntdriveconfig") is { } s ? $"{s}/settings/roles" : null }
        ],
        StepKeys.Rates =>
        [
            new ChecklistItem { Id = "rate-cards", Owner = "DFRNT",
                Item = "Rate cards and spreadsheet import (DF Admin only in Settings).",
                Link = link("dfrntdriveconfig") is { } s ? $"{s}/pricing" : null },
            new ChecklistItem { Id = "speeds", Owner = "DFRNT", Item = "Speeds (services) the tenant sells exist. Settings can only copy an existing speed." },
            new ChecklistItem { Id = "nz-zone-rates", Owner = "DFRNT", Item = "NZ tenants: bulk zone rates (no API yet)." }
        ],
        StepKeys.Couriers =>
        [
            new ChecklistItem { Id = "fleet-assignment", Owner = "Tenant",
                Item = "Couriers assigned to their vehicle fleets in Settings > Driver List (courier create can't set the fleet).",
                Link = link("dfrntdriveconfig") is { } s ? $"{s}/fleet" : null }
        ],
        StepKeys.Automations =>
        [
            new ChecklistItem { Id = "automations", Owner = "Tenant", Required = true,
                Item = "Automation rules set up in Settings > Automations (notifications, auto-assign). Rules go live as soon as they are saved.",
                Link = link("dfrntdriveconfig") is { } s ? $"{s}/settings/automations" : null }
        ],
        StepKeys.Integrations =>
        [
            new ChecklistItem { Id = "integrations", Owner = "Tenant", Required = true,
                Item = "Integrations the tenant needs are connected in Integration Manager (carriers, Shopify, partners).",
                Link = link("integrationmanager") }
        ],
        StepKeys.AppConfig =>
        [
            new ChecklistItem { Id = "admin-setup", Owner = "Tenant", Item = "Admin Setup catalogues (note types, document types, quizzes).",
                Link = link("dfrntdriveconfig") is { } s ? $"{s}/settings/catalogues" : null },
            new ChecklistItem { Id = "dispatch-settings", Owner = "Tenant", Item = "Dispatch settings and sign-up page.",
                Link = link("dfrntdriveconfig") is { } s2 ? $"{s2}/settings/dispatch" : null },
            new ChecklistItem { Id = "consumer-booking", Owner = "Tenant", Item = "Consumer / baggage delivery settings, if used.",
                Link = link("dfrntdriveconfig") is { } s3 ? $"{s3}/settings/baggage-delivery" : null }
        ],
        _ => []
    };

    /// <summary>Adds any checklist items a session is missing (sessions outlive catalogue changes). Never removes ticks.</summary>
    public static void Seed(SetupSession session, Func<string, string?> link)
    {
        foreach (var key in StepKeys.All)
        {
            var step = session.Step(key);
            foreach (var item in Defaults(key, link))
            {
                var existing = step.Checklist.FirstOrDefault(c => c.Id == item.Id);
                if (existing == null)
                {
                    step.Checklist.Add(item);
                }
                else
                {
                    existing.Item = item.Item;
                    existing.Link ??= item.Link;
                    existing.Required = item.Required;
                }
            }
        }
    }

    private static bool IsDone(SetupSession session, string stepKey, string itemId)
        => session.Step(stepKey).Checklist.FirstOrDefault(c => c.Id == itemId)?.DoneAt != null;

    /// <summary>
    /// Anything that emails a person (staff, customers, partners) waits for the tenant's
    /// identity and email wording to be confirmed - Cheetah's new database carried another
    /// tenant's sender address and wording on 24 Oct 2026.
    /// </summary>
    public static string? InviteBlocker(SetupSession session)
        => IsDone(session, StepKeys.Business, TenantIdentity)
            ? null
            : "Waiting for DFRNT to confirm the tenant's system settings and invite wording (Business step) - nobody is emailed before that.";

    /// <summary>Recomputes a step's status from its requests, rows and checklist. "done" is only ever set by a person.</summary>
    public static void Recompute(SetupSession session, string stepKey, bool hasData)
    {
        var step = session.Step(stepKey);
        if (step.Requests.Any(r => r.FulfilledAt == null))
        {
            step.Status = StepStatus.WaitingOnTenant;
        }
        else if (step.Status == StepStatus.Done) { }
        else if (hasData || step.Rows.Count > 0 || step.Checklist.Any(c => c.DoneAt != null))
        {
            step.Status = StepStatus.InProgress;
        }
        else
        {
            step.Status = StepStatus.NotStarted;
        }

        step.UpdatedAt = DateTime.UtcNow;
    }

    public const string CompletedOnDashboard = "dashboard";
    public const string CompletedElsewhere = "elsewhere";
    public const int ElsewhereNoteMin = 3;
    public const int ElsewhereNoteMax = 500;

    /// <summary>A person marks the step done. The session completes when every step is done, however it was done.</summary>
    public static void Complete(SetupSession session, string stepKey, string? by)
    {
        var step = session.Step(stepKey);
        step.Status = StepStatus.Done;
        step.CompletedAt = DateTime.UtcNow;
        step.CompletedBy = by;
        step.CompletedHow = CompletedOnDashboard;
        step.CompletedMethod = null;
        step.CompletedNote = null;
        step.UpdatedAt = DateTime.UtcNow;
        if (session.Steps.Values.All(x => x.Status == StepStatus.Done))
        {
            session.Status = "completed";
        }
    }

    /// <summary>Ticks or unticks a checklist item. Unticking clears who, when and the note.</summary>
    public static void Tick(ChecklistItem item, bool done, string? by, string? note)
    {
        item.DoneAt = done ? DateTime.UtcNow : null;
        item.DoneBy = done ? by : null;
        var n = note?.Trim();
        item.Note = done && !string.IsNullOrEmpty(n) ? n[..Math.Min(n.Length, ElsewhereNoteMax)] : null;
    }

    /// <summary>Why a "done another way" request can't be accepted, or null when it can.</summary>
    public static string? ElsewhereProblem(string? method, string? note)
    {
        if (string.IsNullOrWhiteSpace(method))
        {
            return "Say how it was done.";
        }

        var n = note?.Trim() ?? string.Empty;
        return n.Length is < ElsewhereNoteMin or > ElsewhereNoteMax
            ? $"Add a note of {ElsewhereNoteMin} to {ElsewhereNoteMax} characters saying how it was done."
            : null;
    }

    /// <summary>
    /// The step's work was done outside the dashboard. Skips <see cref="CompleteBlocker"/>: open requests
    /// are fulfilled with the note, and rows not created yet are skipped so no send ever repeats the work.
    /// Required checklist items stay as they are; the note covers them.
    /// </summary>
    public static void CompleteElsewhere(SetupSession session, string stepKey, string? by, string method, string note)
    {
        var step = session.Step(stepKey);
        foreach (var r in step.Requests.Where(r => r.FulfilledAt == null))
        {
            r.FulfilledAt = DateTime.UtcNow;
            r.FulfilledBy = by;
            r.FulfilledNote = note.Trim();
        }

        foreach (var row in step.Rows.Where(r => r.Status is RowStatus.Pending or RowStatus.NeedsData or RowStatus.Failed or RowStatus.Unknown))
        {
            row.Status = RowStatus.Skipped;
            row.UpdatedAt = DateTime.UtcNow;
        }

        Complete(session, stepKey, by);
        step.CompletedHow = CompletedElsewhere;
        step.CompletedMethod = method.Trim();
        step.CompletedNote = note.Trim();
    }

    /// <summary>Back to in progress. Skipped rows go back to pending so they can be sent if wanted.</summary>
    public static void Reopen(SetupSession session, string stepKey)
    {
        var step = session.Step(stepKey);
        step.Status = StepStatus.InProgress;
        step.CompletedAt = null;
        step.CompletedBy = null;
        step.CompletedHow = CompletedOnDashboard;
        step.CompletedMethod = null;
        step.CompletedNote = null;
        foreach (var row in step.Rows.Where(r => r.Status == RowStatus.Skipped))
        {
            row.Status = RowStatus.Pending;
            row.UpdatedAt = DateTime.UtcNow;
        }

        session.Status = "active";
        Recompute(session, stepKey, hasData: false);
    }

    /// <summary>Why a step can't be marked done yet, or null when it can.</summary>
    public static string? CompleteBlocker(SetupSession session, string stepKey)
    {
        var step = session.Step(stepKey);
        if (step.Requests.Any(r => r.FulfilledAt == null))
        {
            return "There are open requests to the tenant.";
        }

        var bad = step.Rows.Where(r => r.Status is RowStatus.Pending or RowStatus.NeedsData or RowStatus.Failed or RowStatus.Unknown).ToList();
        if (bad.Count > 0)
        {
            return $"{bad.Count} record(s) are not created yet.";
        }

        var open = step.Checklist.Where(c => c is { Required: true, DoneAt: null }).Select(c => c.Item).ToList();
        return open.Count > 0 ? $"Required checklist items are open: {open.Count}." : null;
    }
}
