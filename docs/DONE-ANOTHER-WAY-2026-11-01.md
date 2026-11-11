# Set-up Dashboard: steps already done another way

1 Nov 2026. Owner: Jacob. Base: `develop` at ce723dd (GitLab = GitHub).

## The problem

Steve opened the Set-up Dashboard for Crisis on staging. A lot of Crisis is already set up, done directly in Admin Manager, Settings and the database, partly with Claude. For example:

- the tenant client file (client 84, type Tenant);
- the Crisis Admin, Crisis Operations and Customer Admin roles;
- System Settings: company name, address, country AU and logos;
- 15 of 16 notification templates and the Forgot Password wording;
- rate card RK1.

The dashboard still opens at the Business step with every step "Not started". It cannot record any of that work.

Two things cause this:

1. **The dashboard barely looks at the tenant.** `GET session/{id}/tenant-summary` (SetupController) already counts team, clients, contacts, couriers, zones, automations and services in the tenant database. Only the Business step's "system settings now" card calls `getTenantSummary`, and its counts line read PascalCase keys from a camelCase response, so it always showed zeros. No other step shows any of it.
2. **"Mark as done" has only one path.** `StepCatalog.CompleteBlocker` refuses while:
   - any request to the tenant is open;
   - any row is pending, needs data, has failed or is unknown;
   - any required checklist item is open.

   `StepFrame` also disables the button while the draft is dirty. Work done outside the dashboard leaves no rows and ticks no checklist items, so the only way to finish a step is to tick boxes one by one. Even then there is nowhere to record that the work was done another way.

## What we want

A person can mark any step, or any checklist item, as **done another way**, with a short note saying how. The dashboard shows what already exists in the tenant so the person can see it before marking. The rule stays that only a person sets "done": counts suggest, they never mark anything themselves.

## Design

### D1. "Done another way" on a step

- **Button.** `StepFrame` gets a second button next to "Mark as done": **"Done another way…"**. It shows while the step is not done, and is enabled even when the draft is dirty. The dirty draft is discarded and the dialog says so.
- **Dialog.**
  - Title: "Mark *{step title}* as done another way".
  - "How was it done?" is a select: "Directly in Settings / Admin Manager", "Loaded by Claude or the MCP", "By DFRNT before this dashboard", "Not needed for this tenant", "Other".
  - "Note" is required, 3 to 500 characters. Placeholder: "e.g. 15 rate rows loaded on prod 31 Oct (RK1)".
  - Buttons: "Cancel" and "Mark as done".
- **API.** `POST session/{id}/steps/{step}/complete` accepts an optional body `{ how: "elsewhere", method: string, note: string }`. With `how = "elsewhere"`:
  - `CompleteBlocker` is skipped. The `Busy` check stays, so you cannot mark a step done while a send is running.
  - Open requests are fulfilled with `FulfilledBy = caller` and the note.
  - Rows still `pending`, `needs_data`, `failed` or `unknown` move to a new `RowStatus.Skipped = "skipped"`. A skipped row is never sent again, and "Save and send" ignores it. `RowResults` shows it with a grey "Skipped" badge and the step's note as the tooltip.
  - Required checklist items stay as they are, but the step is done. The checklist shows them as "Covered by the step note".
- **Model.** `StepState` gains `CompletedHow` ("dashboard" | "elsewhere", default "dashboard"), `CompletedMethod` (string?) and `CompletedNote` (string?). Old sessions deserialise with the default.
- **Who (decided by Steve, 1 Nov).** DF Admin, or a tenant admin. "Tenant admin" here means tenant staff (`ClientTypeId == CallerContext.TenantClientType`) whose role has the "Edit Settings" role action in Settings. The dashboard has no admin flag of its own today, so add `CallerContext.IsTenantAdmin`. Read it once per session from the Settings roles API, the same way `TeamPusher` already reads roles, and cache it on the caller. Everyone else keeps the normal "Mark as done". Reopen stays DF Admin only.
- **Display.**
  - The step header reads "Done another way by {name} on {date}: {method}. {note}".
  - `StepPill` and `ProgressBar` show done with a small "elsewhere" marker. It counts as done for `stepsDone` and for `Session.Status = "completed"`.
  - `PdfSummary` prints the method and note.
- **Reopen.** Clears `CompletedHow`, `CompletedMethod` and `CompletedNote`. Skipped rows go back to `pending` so they can be sent if wanted.

### D2. Done another way on a checklist item

- `ChecklistItem` gains `Note` (string?).
- The tick endpoint (`.../checklist/{itemId}`) accepts an optional `note`. In the UI, ticking an item opens a small inline "How? (optional)" field, and the note shows under the item with who and when.
- Ownership stays as it is: DFRNT items are DF Admin only.

### D3. "Already in DFRNT" from the tenant

- Call `getTenantSummary` when a session opens and after every send.
- Extend `TenantCounts` with what the tenant summary can already read, using DbSets that are in `DespatchContext` today:
  - `RateCards` (rate cards);
  - `ZoneZips` (postcodes/ZIPs on zones);
  - `ExtraCharges`;
  - `TucAgents` (partners);
  - roles: from Settings `GET /api/admin/roles?clientType=4`, counting active roles with a `tenantClientId` (the tenant's own, not the shared Global Default roles). `TblUserGroups` is the legacy tblUser group table, not Settings roles;
  - `TucClients` with `ClientTypeId == CallerContext.TenantClientType` (tenant client file exists: bool).
- Depots come from Settings' regions lookup (`GET /api/v1/np/regions`, already used by `LookupsController`), so no new entity is needed. Schedules live in Routed Operations and are left out of the strip for now.
- Each step shows a one-line **"Already in DFRNT"** strip above its body when its count is above zero:

| Step | Strip text (example) |
|---|---|
| Business | "Tenant client file exists. Company name: Crisis Global Logistics. Country: AU." (from `TblSettings`) |
| Team | "12 staff on the tenant's client file, 3 roles." |
| Clients | "5 clients, 9 contacts." |
| Rates | "1 rate card, 4 services, 42 zones, 1,180 postcodes on zones, 6 extra charges." |
| Couriers | "18 couriers." |
| Partners | "2 partners." |
| Automations | "3 active automation rules." |

- The strip has one button, **"Done another way…"**. It opens D1 with "Already in DFRNT" picked as the method and the strip text as the note, ready to edit.
- **Business pre-fill.** When `session.Business` is empty, pre-fill `CompanyName` and `Country` from `TblSettings` (`SystemName`, unless it is still "Despatch Manager", and `CountryCode`). They go in as the draft only, not saved until the person saves. `BusinessProfile` has no address field, so the address is not pre-filled; the Business step already shows `CompanyAddress` read-only.

### D4. Opening a set-up for a tenant that is part done

- When a new session is created for a tenant whose summary shows any data, open on a **"Where this tenant is up to"** panel instead of the Business step.
- The panel lists each step with its "Already in DFRNT" line and a checkbox, plus **"Mark the ticked steps done another way"**. That one note is applied to every ticked step, with the method "Already in DFRNT".
- One action, one note, many steps, so a part-done tenant can be brought up to date in a minute.

### D5. What Garry's tenant seed has already done

Every new tenant database comes from Garry's automated tenant seed. That seed already does much of the Business and Team steps, so a fresh session should not show those as not started. Below is what the seed covered, as checked on Crisis production on 29 Oct 2026; the full write-up is the "Seed check" section of the tenant-setup how-to.

| Seed did | Dashboard item it covers | How the dashboard can tell (read-only) |
|---|---|---|
| Tenant's own client file (client type Tenant; Crisis client 84) | Business checklist `tenant-client-file` | A `TucClients` row with `ClientTypeId == CallerContext.TenantClientType` |
| Roles: *Tenant* Admin, *Tenant* Operations, Customer Admin, with their Hub tiles | Team step (roles exist); Team checklist `role-actions` only partly | `TblUserGroups` count > 0 (or the Settings roles API). Role actions still need a person to review them. |
| System Settings cleared of Urgent's details (address, logos, Internet Root, reply-from addresses, switches), sign-up map centre | Part of Business checklist `tenant-identity` | `TblSettings.CompanyAddress` is set and is not Urgent's |
| 15 of 16 notification templates reworded for the tenant | Part of `tenant-identity` | Not readable from `DespatchContext` today (`tblSMPPSettings`); leave it to a person |

The seed does **not** do these. They stay open until a person ticks them; on Crisis they were done by hand on 29 to 31 Oct:

- the Forgot Password template, which is the Hub invite and still carries Urgent's wording;
- the Email Settings reply-to address;
- the Internet Booker staff record and Internet Job Staff (the HOWTO says Garry is adding this to the seed);
- System Name, which the seed leaves as "Despatch Manager";
- CountryCode (NULL on Crisis);
- the GST rate (0 on Crisis);
- the Google SMTP user (Garry);
- the S3 `tenantLogo.png`;
- depots.

So `tenant-identity` is split into two items, and the D3 strip reads the seed's results:

- **`tenant-identity-seed`.** The seed's System Settings and templates. It is marked as "Seeded" automatically when the checks in the table pass, as a suggestion with a one-click confirm, never a silent tick. It is not required to be ticked by hand.
- **`tenant-identity`** (required). Unchanged, but the text now lists only what the seed leaves:
  - "Forgot Password / Hub invite wording, Email Settings reply-to, System Name (not 'Despatch Manager'), CountryCode, GST rate, Internet Booker."
  - The Business strip shows the live values of `SystemName`, `CountryCode` and the GST rate, so a wrong one stands out (for example "Despatch Manager", or a blank CountryCode).

`InviteBlocker` keeps keying on `tenant-identity` (the hand-checked part), because the seed alone has left Urgent's invite wording in place.

**Ask Garry (Questions, item 3):** could the seed write a marker the dashboard can read, such as a seed version and date in a tenant setting or in Master Controller? Then the dashboard can say "Tenant seed v{n} ran on {date}" and pre-confirm the seeded items without inferring them.

## Review against the code (2 Nov 2026)

Checked on `develop` 063199c before building M1 to M4. Where the code differed, the design above has been corrected.

- **`skipped` already existed on the frontend** (TS `RowStatus`, grey "Skipped" pill, the help doc) but not in the backend. Only the backend status and the tooltip were new.
- **Skipped rows are held back the same way as unknown rows.** Each pusher loop already skipped `IsUnknown` rows. That check is now `RowLedger.IsHeld` (unknown or skipped), so no pusher sends a skipped row. `PruneStale` already kept them.
- **Tenant admin.** "The same way `TeamPusher` reads roles" doesn't work, because `/api/admin/roles` says nothing about the caller. Settings has `GET /api/me/permissions`, which returns the signed-in person's permission keys. The "Edit Settings" role action is the key `edit-settings` (dbo.Permission, migration 20260528090000). `TenantAdminCheck` asks Settings and caches a yes or no for 10 minutes per person; a failed call means no and is not cached. Login validate now returns `isTenantAdmin`.
- **Requests closed by "done another way"** keep the note in a new `DataRequest.FulfilledNote`.
- **Seed suggestion.** `tenant-identity-seed` shows "Looks seeded" with a Confirm button when the tenant client file exists and `CompanyAddress` is set and neither it nor `AdminEmail` names Urgent. Confirm is an ordinary tick with a note. Nothing is ticked automatically.
- **Existing gaps, not changed here:** `complete` and `fulfil` have no role check, and anyone signed in can tick tenant-owned checklist items. That matches "everyone else keeps the normal Mark as done".
- **Milestones.** M3b is in this spec but not on the dashboard item, which has M1 to M5.

## Out of scope

- Detecting whether a checklist item is done (identity wording, logo, role actions). A person still ticks those.
- Writing anything to the tenant. The dashboard stays read-only on the tenant database.

## Milestones

| # | Title | Done when |
|---|---|---|
| M1 | Done another way on a step (D1) | `IsTenantAdmin` (Edit Settings role action), endpoint body, `StepState` fields, `RowStatus.Skipped`, dialog, pill/progress/PDF display, "Skipped" badge in Row results, Reopen clears it; xUnit covers blocker bypass, skipped rows not re-sent, Reopen |
| M2 | Checklist item note (D2) | Note stored and shown with who/when; DFRNT ownership rule unchanged |
| M3 | Already in DFRNT strip (D3) | `getTenantSummary` called, `TenantCounts` extended, strip on each step, button pre-fills D1, Business draft pre-filled from `TblSettings` |
| M3b | Tenant seed recognised (D5) | `tenant-identity` split into `tenant-identity-seed` (auto-suggested from the read-only checks) and the hand-checked `tenant-identity` with the narrowed text; Business strip shows SystemName, CountryCode, GST rate; tenant client file and roles detected |
| M4 | Where this tenant is up to (D4) | New sessions on a tenant with data open on the panel; bulk mark with one note |
| M5 | Staging test on Crisis | On Crisis staging: open Crisis, panel shows its counts, mark Business, Team and Rates done another way, reopen one, PDF shows method and note; MR raised to develop |

## Questions for Steve

1. ~~Who can use "Done another way"?~~ Decided 1 Nov: DF Admin or a tenant admin (see D1).
2. ~~Skipped rows visible or hidden?~~ Decided 1 Nov: visible in Row results with a grey "Skipped" badge and the step note as its tooltip.
3. (Garry) Can the tenant seed record its version and run date somewhere the dashboard can read, and is the Internet Booker step in the seed yet?
