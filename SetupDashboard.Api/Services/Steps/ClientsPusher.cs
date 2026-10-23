using SetupDashboard.Models;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Services.Steps;

/// <summary>
/// Customers through Settings <c>POST /api/v1/tenant/clients</c> (Clients &amp; Customers), then any extra
/// booking contacts through <c>POST /api/v1/tenant/clients/{id}/contacts</c>.
/// </summary>
/// <remarks>
/// Mandatory fields are Settings' own (TenantClientsService.CreateAsync / ValidateCreate on develop
/// 3a3fde0): name, code, address, suburb, city, invoice schedule, payment term, and a primary contact
/// with first name + email. In a US tenant Settings labels suburb "City" and city "State", and so do we.
/// Nothing is defaulted: an empty field is a "needs", never "Unknown" or "NY".
/// </remarks>
public sealed class ClientsPusher(ITenantAppClient apps) : IStepPusher
{
    public const string ClientKind = "client";
    public const string ContactKind = "client-contact";

    public string StepKey => StepKeys.Clients;

    public static Needs Validate(ClientRow c, bool usTenant)
        => new Needs()
            .Text(c.Code, "client code")
            .Text(c.Name, "name")
            .Text(c.Address, "street address")
            .Text(c.Suburb, usTenant ? "city" : "suburb")
            .Text(c.City, usTenant ? "state" : "city")
            .Value(c.InvoiceScheduleId, "invoice schedule")
            .Value(c.PaymentTermId, "payment term")
            .Text(c.PrimaryContact.FirstName, "primary contact first name")
            .Text(c.PrimaryContact.Email, "primary contact email")
            .When(!c.InviteConfirmed, "tick 'send sign-in invite' (creating the customer emails the primary contact)");

    public static Needs Validate(ClientContactRow c)
        => new Needs()
            .When(string.IsNullOrWhiteSpace(c.FirstName) && string.IsNullOrWhiteSpace(c.Surname), "first name or surname")
            .Text(c.Email, "email (it is their sign-in)");

    public async Task PushAsync(SetupSession session, CallerContext caller, CancellationToken ct)
    {
        var ledger = new RowLedger(session.Step(StepKey));
        var inviteBlocker = StepCatalog.InviteBlocker(session);

        foreach (var c in session.Clients)
        {
            var code = c.Code?.Trim() ?? "";
            var row = ledger.Row(ClientKind, code.Length > 0 ? code : c.Name?.Trim() ?? "(no code)");

            int? clientId;
            if (ledger.AlreadyCreated(ClientKind, row.Key, out var created)) clientId = created;
            else
            {
                var needs = Validate(c, caller.IsUsTenant);
                if (inviteBlocker != null) needs.When(true, inviteBlocker);
                if (needs.Any) { RowLedger.NeedsData(row, needs.Items); continue; }

                var res = await apps.SendAsync(TenantApp.Settings, HttpMethod.Post, "/api/v1/tenant/clients", new
                {
                    name = c.Name!.Trim(),
                    code,
                    active = true,
                    address = c.Address!.Trim(),
                    unit = c.Unit?.Trim() ?? "",
                    postCode = c.PostCode?.Trim() ?? "",
                    suburb = c.Suburb!.Trim(),
                    city = c.City!.Trim(),
                    country = c.Country?.Trim() ?? "",
                    latitude = c.Latitude,
                    longitude = c.Longitude,
                    phone = c.Phone?.Trim() ?? "",
                    email = c.Email?.Trim() ?? "",
                    invoiceEmail = c.InvoiceEmail?.Trim() ?? "",
                    invoiceScheduleId = c.InvoiceScheduleId!.Value,
                    paymentTermId = c.PaymentTermId!.Value,
                    invoiceMethod = c.InvoiceMethod?.Trim() ?? "",
                    notes = c.Notes?.Trim() ?? "",
                    primaryContact = new
                    {
                        firstName = c.PrimaryContact.FirstName!.Trim(),
                        surname = c.PrimaryContact.Surname?.Trim() ?? "",
                        email = c.PrimaryContact.Email!.Trim(),
                        mobile = c.PrimaryContact.Mobile?.Trim() ?? "",
                        jobTitle = c.PrimaryContact.JobTitle?.Trim() ?? "",
                        active = true,
                    },
                }, ct);

                if (!res.Ok || res.Id == null) { RowLedger.Failed(row, res); continue; }
                clientId = res.Id;
                var notice = res.Body?["notice"]?.GetValue<string>();
                var noGeo = c.Latitude == null || c.Longitude == null
                    ? " No map position was given - set it on the customer in Settings before using client-address schedules."
                    : "";
                RowLedger.Created(row, clientId, (notice ?? "") + noGeo);
            }

            foreach (var contact in c.Contacts)
            {
                var email = contact.Email?.Trim() ?? "";
                var cKey = $"{code} / {(email.Length > 0 ? email : "(no email)")}";
                if (ledger.AlreadyCreated(ContactKind, cKey, out _)) continue;
                var cRow = ledger.Row(ContactKind, cKey);

                var needs = Validate(contact);
                if (contact.CreateSignIn && inviteBlocker != null) needs.When(true, inviteBlocker);
                if (needs.Any) { RowLedger.NeedsData(cRow, needs.Items); continue; }

                var res = await apps.SendAsync(TenantApp.Settings, HttpMethod.Post, $"/api/v1/tenant/clients/{clientId}/contacts", new
                {
                    firstName = contact.FirstName?.Trim() ?? "",
                    surname = contact.Surname?.Trim() ?? "",
                    email,
                    mobile = contact.Mobile?.Trim() ?? "",
                    jobTitle = contact.JobTitle?.Trim() ?? "",
                    active = true,
                }, ct);
                if (!res.Ok || res.Id == null) { RowLedger.Failed(cRow, res); continue; }

                string? signInNotice = null;
                if (contact.CreateSignIn)
                {
                    var signIn = await apps.SendAsync(TenantApp.Settings, HttpMethod.Post,
                        $"/api/v1/tenant/clients/{clientId}/contacts/{res.Id}/access/create-signin", new { }, ct);
                    signInNotice = signIn.Ok
                        ? signIn.Body?["message"]?.GetValue<string>() ?? "Sign-in created and invite sent."
                        : $"Contact created, but the sign-in wasn't: {string.Join(" ", signIn.Messages)}";
                }
                RowLedger.Created(cRow, res.Id, signInNotice);
            }
        }
    }

    /// <summary>Settings client id for a customer code created on this session's Clients step.</summary>
    public static int? ClientIdFor(SetupSession session, string? code)
        => new RowLedger(session.Step(StepKeys.Clients)).IdOf(ClientKind, code);
}
