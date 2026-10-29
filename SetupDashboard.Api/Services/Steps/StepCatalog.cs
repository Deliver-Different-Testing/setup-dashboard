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
    public const string TenantClientFile = "tenant-client-file";
    public const string Depots = "depots";

    public static IReadOnlyList<ChecklistItem> Defaults(string stepKey, Func<string, string?> link) => stepKey switch
    {
        StepKeys.Business =>
        [
            new() { Id = TenantClientFile, Required = true, Owner = "DFRNT",
                Item = "Tenant's own client file exists (client type Tenant). Staff and roles hang off it; there is no API to create it yet." },
            new() { Id = TenantIdentity, Required = true, Owner = "DFRNT",
                Item = "System settings and email wording are this tenant's: company name, address, bank/tax, sender and reply addresses, sign-in invite and password-reset wording. New tenant databases can carry another tenant's values - check before anyone is invited.",
                Link = link("adminmanager") is { } am ? $"{am}/#/setting/1" : null },
            new() { Id = Depots, Required = true, Owner = "DFRNT",
                Item = "Depots created (needed by schedules, distance rates and fleets). Admin Manager only for now." },
            new() { Id = "logo", Owner = "DFRNT", Item = "Tenant logo uploaded (no upload API yet)." },
        ],
        StepKeys.Team =>
        [
            new() { Id = "role-actions", Owner = "DFRNT",
                Item = "Role actions reviewed (View Financial Data, Manage Users, Edit Settings...). They follow each tile unless switched off; DF Admin sets them in Settings > Roles.",
                Link = link("dfrntdriveconfig") is { } s ? $"{s}/settings/roles" : null },
        ],
        StepKeys.Rates =>
        [
            new() { Id = "rate-cards", Owner = "DFRNT",
                Item = "Rate cards and spreadsheet import (DF Admin only in Settings).",
                Link = link("dfrntdriveconfig") is { } s ? $"{s}/pricing" : null },
            new() { Id = "speeds", Owner = "DFRNT", Item = "Speeds (services) the tenant sells exist. Settings can only copy an existing speed." },
            new() { Id = "nz-zone-rates", Owner = "DFRNT", Item = "NZ tenants: bulk zone rates (no API yet)." },
        ],
        StepKeys.Couriers =>
        [
            new() { Id = "fleet-assignment", Owner = "Tenant",
                Item = "Couriers assigned to their vehicle fleets in Settings > Driver List (courier create can't set the fleet).",
                Link = link("dfrntdriveconfig") is { } s ? $"{s}/fleet" : null },
        ],
        StepKeys.Automations =>
        [
            new() { Id = "automations", Owner = "Tenant", Required = true,
                Item = "Automation rules set up in Settings > Automations (notifications, auto-assign). Rules go live as soon as they are saved.",
                Link = link("dfrntdriveconfig") is { } s ? $"{s}/settings/automations" : null },
        ],
        StepKeys.Integrations =>
        [
            new() { Id = "integrations", Owner = "Tenant", Required = true,
                Item = "Integrations the tenant needs are connected in Integration Manager (carriers, Shopify, partners).",
                Link = link("integrationmanager") },
        ],
        StepKeys.AppConfig =>
        [
            new() { Id = "admin-setup", Owner = "Tenant", Item = "Admin Setup catalogues (note types, document types, quizzes).",
                Link = link("dfrntdriveconfig") is { } s ? $"{s}/settings/catalogues" : null },
            new() { Id = "dispatch-settings", Owner = "Tenant", Item = "Dispatch settings and sign-up page.",
                Link = link("dfrntdriveconfig") is { } s2 ? $"{s2}/settings/dispatch" : null },
            new() { Id = "consumer-booking", Owner = "Tenant", Item = "Consumer / baggage delivery settings, if used.",
                Link = link("dfrntdriveconfig") is { } s3 ? $"{s3}/settings/baggage-delivery" : null },
        ],
        _ => [],
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
                if (existing == null) step.Checklist.Add(item);
                else
                {
                    existing.Item = item.Item;
                    existing.Link ??= item.Link;
                    existing.Required = item.Required;
                }
            }
        }
    }

    public static bool IsDone(SetupSession session, string stepKey, string itemId)
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
        if (step.Requests.Any(r => r.FulfilledAt == null)) step.Status = StepStatus.WaitingOnTenant;
        else if (step.Status == StepStatus.Done) { }
        else if (hasData || step.Rows.Count > 0 || step.Checklist.Any(c => c.DoneAt != null)) step.Status = StepStatus.InProgress;
        else step.Status = StepStatus.NotStarted;
        step.UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Why a step can't be marked done yet, or null when it can.</summary>
    public static string? CompleteBlocker(SetupSession session, string stepKey)
    {
        var step = session.Step(stepKey);
        if (step.Requests.Any(r => r.FulfilledAt == null)) return "There are open requests to the tenant.";
        var bad = step.Rows.Where(r => r.Status is RowStatus.Pending or RowStatus.NeedsData or RowStatus.Failed or RowStatus.Unknown).ToList();
        if (bad.Count > 0) return $"{bad.Count} record(s) are not created yet.";
        var open = step.Checklist.Where(c => c.Required && c.DoneAt == null).Select(c => c.Item).ToList();
        if (open.Count > 0) return $"Required checklist items are open: {open.Count}.";
        return null;
    }
}
