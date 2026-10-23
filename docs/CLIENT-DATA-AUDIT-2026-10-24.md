# Setup Dashboard - client data audit (24 Oct 2026)

**Question (Steve):** are the Setup Dashboard steps up to date for inserting client data correctly?
**Answer:** No. The Clients and Team steps write through Admin Manager using the pre-September model. Clients go in with invented addresses and no account, rating or site setup; customer contacts are never written; staff "users" are created in a table that no longer gives anyone a login. Do not use it to load a live tenant (Cheetah, OTG, Crisis) until the P0 items below are fixed. Load clients through Settings (Customers / Contacts) or the MCP instead.

**Source audited:** `gitlab.com/deliver-different/setup-dashboard` `develop` `b6bac26` (14 Oct). `master` `efe9284` is the same code without the 14 Oct tile gate; its only later commits are auto-deploy values (Cheetah staging/prod added 22 Oct, Cheetah prod replaced by OTG Cargo 23 Oct). App code is unchanged since the initial commit on 24 Apr 2026. Admin Manager checked against the local clone (`ebbf106`, 29 Sep), so its line numbers are approximate.

## How client data flows today

| Step | UI collects | Backend writes | Target |
|---|---|---|---|
| 1 Team | name, email, role (Admin / Dispatcher / Accounts / Driver Manager) | `POST /API/User` (UserName, FullName, random password, UserGroupId) | Admin Manager -> legacy `tblUser` |
| 2 Clients | company, contact name, phone, email, billing (manual); plus address/city/state/zip from Smart Import | `POST /api/client` | Admin Manager -> `tucClient` |
| 2 Client contacts | company, first, last, email, phone, role, primary | nothing | browser localStorage only |
| Go-live | - | zones -> rates -> clients -> couriers -> users -> automations | Admin Manager |

Every write goes through Admin Manager, which is retiring ([AdminManager + ClientManager retiring], 2026). Steve's rule: no new writes there.

## Findings

### P0 - wrong or unsafe data

1. **Invented addresses on every manually entered client.** `ProvisioningService.ProvisionClientsAsync` sends `americanCity = "Unknown"`, `americanState = "NY"`, `americanZipCode = "10001"`, `addressStreetName = "123 Main St"` whenever the field is blank. The manual form has no address fields, so every hand-entered client gets a fake New York address. That address drives schedule origin (Client address option), geocoding and rating.
2. **Tenant-specific ids hard-coded in Admin Manager.** No `SuburbId` / `SiteId` is sent, so `ClientService.CreateClient` falls back to `SuburbId 152 // Unknown` and `SiteId 43 // USA`. Those are row ids from one database; on another tenant they point at a different suburb/site or at nothing. `SiteId` is also the key for the multi-accounting-files spec (`tblAccountingConnection` by `tblSite`). No lat/long is sent either.
3. **Team step creates people who cannot log in.** `POST /API/User` writes a legacy `tblUser` row with a random password that is thrown away. It does not create the things a login needs today: a `tucClientContact` on the tenant's own client (ClientTypeId 4), a **Master Controller user** (Hub `POST /api/admin/users/tenant`), and a role. Settings > Users and Roles > Add Contact (`AdminContactService` -> `NpUserInviteService`) does all of that, and also sends the invite.
4. **Unmatched role falls back to UserGroup 1.** If the role name doesn't match a UserGroup name, `userGroupId` is set to 1. In legacy data group 1 is the administrator group (the configurator resolver comments note `UserGroupID == 1` used to mean DF admin). A typo grants the most powerful legacy group.
5. **Endpoints open to anonymous callers, with a shared Admin Manager login.** 22 of the 26 `SetupController` endpoints are `[AllowAnonymous]`, including `team`, `clients`, `rates`, `couriers`, `automations`, `session/{id}/full` and `session/{id}/rollback`. `AdminManagerClientFactory` caches one authenticated client per environment and shares it across callers, and `EnsureAuthenticated` falls back to `DFRNT_USERNAME` / `DFRNT_PASSWORD` when no cookie is present. So once anyone has authenticated, or the env creds are set, an unauthenticated request can write to Admin Manager as that identity. On `develop` the 14 Oct `[RequireFeature]` gate probably blocks callers without a Hub cookie (its catalogue store throws without the `Connection` claim); **`master`, which is what auto-deploys, does not have that gate.** Confirm against the running pods before any tenant uses it.

### P1 - incomplete

6. **Client contacts are never saved.** `clientContacts` lives in the zustand store and is persisted to localStorage only. It is not in `ClientRecord`, not sent to `POST clients`, and there is no contact provisioning method. Booking users for each customer have to be added afterwards.
7. **Billing choice is dropped.** The UI collects Monthly / etc. per client; `ClientRecord.Billing` is never sent, and Admin Manager hard-codes `UcclBillingType = 3`.
8. **No account status, rate or zone assignment.** Clients go in with no `UcclAccountStatus` (the 8 Oct customer-booking-access spec makes `BlocksBooking` on `tucAccountStatus` the booking gate), no rate card or zone group, and none of the client-first rating setup (rating-ux spec 15 Oct). Rates step provisions a rate card + fuel only (no zone rates, breaks or zips - known since 13 Oct).
9. **ClientTypeId never sent.** Admin Manager defaults to 2 (Customer), which is right for customers. But there is no way to create the tenant's own client (type 4) or a network partner (type 3), which Cheetah needed ("Cheetah Final Mile", Tenant) and which Settings Add Contact needs before staff can be added.
10. **Type and code.** `type` defaults to "Standard" (stored upper-case as `UcclType`); code defaults to the first 10 characters of the name, upper-cased, without spaces, so "Acme Freight Ltd" and "Acme Freight Inc" collide. The `validate/client-code` check only looks at active clients; the unique index will still reject an inactive duplicate.

### P2 - reliability

11. **Saves report success before the write.** Each step's save returns `{ success: true }` and runs the Admin Manager push in `Task.Run`; failures are only logged. The operator never sees "client X failed".
12. **Resume skips by position, not by record.** `if (alreadyProvisioned != null && i < alreadyProvisioned.Count) continue;` skips the first N rows, where N = ids created so far. If row 1 failed and row 2 succeeded, the next save skips row 1 (never created) and re-posts row 2 (duplicate). Editing or re-ordering the list has the same effect.
13. **Session object shared across the background task.** The `Task.Run` closure mutates `session.ProvisionedIds` and calls `_sessions.Update` while the request may already have returned and another save may run, so ids can be lost.

## What "correct" looks like now (target)

Use the same path Settings uses, not Admin Manager:

1. Tenant's own client (ClientTypeId 4) exists, named for the tenant.
2. Roles created in Settings > Roles, tagged Tenant Staff. New roles start with **every tile denied**. Tiles are set in **Advanced Settings > Access Control > step 3 Roles**, not in the role modal. Role actions (View Financial Data etc.) inherit from their tile unless set off in the role modal.
3. Staff added in Settings > Contacts on the tenant client with a role. That creates the contact, the Master Controller user (current tenant = the caller's tenant) and sends the Hub invite (no opt-out).
4. Customers (ClientTypeId 2) with a real address (geocoded), site, account status, billing type and rate/zone assignment.
5. Customer contacts (booking users) per customer, with relationship label.

## Recommendation

- **Now:** don't run Clients / Team / go-live on a live tenant. Remove the fake address defaults and the `DFRNT_USERNAME/PASSWORD` fallback, and drop `[AllowAnonymous]` from every write endpoint (keep it only where Hub's own flow needs it). Small, and removes the unsafe behaviour.
- **Next:** move Team onto the Settings contact path (Hub `users/tenant` + role) and Clients onto the dfrnt-mcp write tools, per the 14 Oct service-auth recommendation C (`docs/SERVICE-AUTH-FOR-PROVISIONING-2026-10-14.md`). Send contacts, billing, account status, site and a geocoded address; return per-row results to the UI.
- **Owner:** decision for Steve - Jacob (agent-access MCP phase) or Kevin (original builder).

## Milestones

| # | Title | Done when |
|---|---|---|
| M0 | Stop-gap safety | Fake address defaults gone; env credential fallback gone; write endpoints require auth; deployed from master |
| M1 | Team via Settings path | Team step creates tenant contact + Master Controller user + role via Hub `users/tenant`; per-row result shown |
| M2 | Clients carry real data | Address (geocoded), site, account status, billing type sent; no hard-coded ids; code collisions handled |
| M3 | Client contacts written | Booking users created per client with relationship label |
| M4 | Off Admin Manager | Clients/rates/zones written through dfrnt-mcp tools; idempotency by record key, not index |
| M5 | End-to-end test | One staging tenant loaded start to finish; logins work; result in Slack |
