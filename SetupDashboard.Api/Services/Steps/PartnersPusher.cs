using SetupDashboard.Models;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Services.Steps;

/// <summary>
/// Agents and network partners through Settings <c>POST /api/v1/tenant/agents</c>
/// (Agents &amp; Network Partners). With a contact email, Settings creates the partner's client,
/// its primary contact and a Hub login, and emails an invite.
/// </summary>
/// <remarks>
/// Settings copies site/billing values for a new partner's client from an existing client, so on a
/// brand-new tenant this step can only succeed after at least one customer exists (gap G8) - its
/// message comes back verbatim if not.
/// </remarks>
public sealed class PartnersPusher(ITenantAppClient apps) : IStepPusher
{
    public const string PartnerKind = "partner";

    public string StepKey => StepKeys.Partners;

    public static Needs Validate(PartnerRow p)
    {
        var hasLogin = !string.IsNullOrWhiteSpace(p.ContactEmail);
        return new Needs()
            .Text(p.Name, "name")
            .When(hasLogin && p.PrimaryContactRoleId == null, "role for the partner's contact")
            .When(hasLogin && !p.InviteConfirmed, "tick 'send sign-in invite' (the contact is emailed)")
            .When(p.DefaultCourierPayPercent is <= 0 or > 100, "driver pay % between 0 and 100");
    }

    public async Task PushAsync(SetupSession session, CallerContext caller, CancellationToken ct)
    {
        var ledger = new RowLedger(session.Step(StepKey));
        var inviteBlocker = StepCatalog.InviteBlocker(session);

        foreach (var p in session.Partners)
        {
            var key = p.Name?.Trim() ?? "";
            if (ledger.AlreadyCreated(PartnerKind, key, out _)) continue;
            if (ledger.IsUnknown(PartnerKind, key)) continue;
            var row = ledger.Row(PartnerKind, key.Length > 0 ? key : "(unnamed partner)");

            var needs = Validate(p);
            if (!string.IsNullOrWhiteSpace(p.ContactEmail) && inviteBlocker != null) needs.When(true, inviteBlocker);
            if (needs.Any) { RowLedger.NeedsData(row, needs.Items); continue; }

            var res = await apps.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/v1/tenant/agents", new
            {
                name = key,
                isNetworkPartner = p.IsNetworkPartner,
                contactName = p.ContactName?.Trim() ?? "",
                contactEmail = p.ContactEmail?.Trim() ?? "",
                primaryContactRoleId = p.PrimaryContactRoleId,
                phone = p.Phone?.Trim() ?? "",
                addressLine1 = p.AddressLine1?.Trim() ?? "",
                city = p.City?.Trim() ?? "",
                state = p.State?.Trim() ?? "",
                postCode = p.PostCode?.Trim() ?? "",
                defaultCourierPayPercent = p.DefaultCourierPayPercent / 100m,
            }, ct);

            if (!res.Ok) { RowLedger.Failed(row, res); continue; }
            RowLedger.Created(row, res.Id, res.Messages.Count > 0 ? string.Join(" ", res.Messages) : null);
        }
    }
}
