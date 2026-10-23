# Setup Dashboard rewrite - design (24 Oct 2026)

**Owner:** Jacob (merge from GitHub). **Built by:** Claude for Steve. **Base:** `develop` `b6bac26`. **Branch:** `feat/settings-rewrite`.
**Why:** the dashboard writes through legacy Admin Manager with dummy defaults, users it creates can't log in, and most endpoints are anonymous. See `docs/CLIENT-DATA-AUDIT-2026-10-24.md` (setup-dashboard `docs/client-data-audit-2026-10-24`).

## What stays, what changes

**Stays:** a separate app the tenant can see; the step-by-step journey; Smart Import (file detect, column match, preview); training step; .NET 10 + React 19 + Redis sessions + Hub shared cookie.

**Changes:**
1. Every write goes through the app that owns the data today: **Settings** (configurator), **Routed Operations**, **Integration Manager**. Admin Manager and the 183-method TMS SDK are removed.
2. No defaults invented by the dashboard. Each step's form carries the target API's mandatory fields; a row that is missing one is not sent, and the step stays open with "needs: <field>".
3. Writes happen as the signed-in person, row by row, and the result of each row comes back to the screen (no fire-and-forget).
4. Progress is a first-class model: each step is Not started / Waiting on tenant / In progress / Done, and records what DFRNT asked the tenant for and when.
5. Things no API can write yet become **"DFRNT does this" checklist items** with a named owner and a tick, not silent gaps.
6. Security: no anonymous endpoints, no shared Admin Manager login, no env-credential fallback, sessions scoped to the tenant, no card data.

## Architecture

```
Browser (tenant admin or DF staff, Hub cookie)
   -> SetupDashboard.Api  (same cookie domain; [Authorize] fallback + RequireFeature hub-tile-setup-dashboard)
        -> TenantAppClient (per request, built from the caller's .AspNet.SharedCookie)
             - adds X-Requested-With: XMLHttpRequest on every write
             - warms each app once per session: GET <app>/  (seeds {tenant}-<App>-Connection in Redis; Settings also enriches claims)
             - base URL = env TenantURL with app_name -> dfrntdriveconfig | routedoperations | integrationmanager
             - 302 => "sign-in expired", 403 => "your role can't do this", 400 => target's own messages, verbatim
        -> Redis: setup-session:{tenantId}:{id}, setup-sessions:{tenantId}
```

- Browser never calls Settings directly (Settings has no CORS); the dashboard backend forwards the cookie.
- Who can do what is decided by the target app's own policies. The dashboard shows a step's push button only when the caller's lane allows it (DF Admin 5 = all; Tenant 4 = whatever Settings/Routed Ops allow; e.g. rate cards and rate import are DF Admin only).

## Steps (new order)

| # | Step | Writes to | Mandatory fields (from target API) | DFRNT-does-this items |
|---|---|---|---|---|
| 0 | Business | session only | company name, primary contact name + email | tenant logo upload (no API), tenant client file (Tenant, ClientTypeId 4) exists, depots exist |
| 1 | Team | Settings roles, Access Control tiles, contacts | role: name, clientTypeIds=[4]; tiles: per role; person: email, role | role actions (DF Admin only endpoint) |
| 2 | Clients | Settings customers + contacts | name, code, address, suburb/city, state/city label per country, invoiceScheduleId, paymentTermId, primary contact first name + email | - |
| 3 | Rates & zones | Settings Rates & Pricing | per object (see appendix B); rates always send `clientIds` | rate card + spreadsheet import if caller isn't DF Admin; NZ bulk zone rates (no API); new speeds (copy only, DF Admin) |
| 4 | Schedules | Routed Ops Schedules (NEW) | name, regionId (depot), dayWindows (day, start, end); client origin needs originRegionId + isDefault=false + >=1 client | depots |
| 5 | Couriers | Settings fleets + couriers | fleet name; courier first + last name, email, initial password | - |
| 6 | Partners | Settings agents / NPs (+ contacts) | name; for NP login: contactEmail + primaryContactRoleId | - |
| 7 | Automations | Settings automations | name, >=1 condition, >=1 action | - |
| 8 | Integrations | Integration Manager (deep links + manual tick in v1) | - | each integration the tenant needs |
| 9 | App config | Settings Admin Setup / Baggage Delivery / Dispatch / Sign-up (deep links + tick in v1) | - | - |
| 10 | Training | session only (unchanged) | - | - |

Steps 8-9 stay checklist-with-links in v1: they are configuration screens the tenant should use directly, and their write APIs are already there for a later pass.

## Progress model

```jsonc
StepState {
  key: "clients",
  status: "not_started" | "waiting_on_tenant" | "in_progress" | "done",
  requests: [ { id, item: "Customer list with addresses", requestedAt, requestedBy, dueBy?, fulfilledAt? } ],
  rows:     [ { key: "ACME", status: "pending|sent|created|failed|skipped", entityId?, errors: [] } ],
  checklist:[ { id, item: "Create depots", owner: "DFRNT", doneAt?, doneBy? } ],
  updatedAt
}
```
- `waiting_on_tenant` = any open request. The header shows "Waiting on <Tenant>: 2 items" and the days outstanding.
- Row identity is a natural key (client code, person email, fleet name, schedule name...), not list position. Re-running a step skips rows already `created`, and updates rather than duplicates.

## Auth and safety

- `FallbackPolicy = RequireAuthenticatedUser`; every `[AllowAnonymous]` removed. Health checks stay anonymous.
- Session ownership: tenant from `CurrentTenantID` claim; a session from another tenant 404s.
- Tenant access to the app: DF Admin opens `hub-tile-setup-dashboard` for Tenant on that tenant (Availability + Audience) and grants it to the admin role. Server gate already enforces gate 1; gate 2 (role) is Hub's.
- Removed: `AdminManagerClient`, `ProvisioningService`, `Services/TmsApi/*`, `Models/TmsApi/*`, `DFRNT_USERNAME/PASSWORD`, `auth/{env}.json` session files, client-chosen `Environment`, card fields.
- Never creates `tucStaff` or `tblUser` (staff file not needed). Test asserts it.
- Inviting people sends an email: the Team and Clients steps show "This sends a sign-in invite to <email>" and need a per-row tick.

## Decisions for Steve (defaults chosen if no answer)

| # | Question | Default |
|---|---|---|
| D1 | Gaps with no API (depots, tenant client file, logo, NZ bulk zone rates, new speeds, IM fuel surcharge) | DFRNT checklist items now; separate specs to add APIs later |
| D2 | Courier initial password (courier create requires one; it is stored in plain text on tucCourier) | operator types it, shown once; never generated or defaulted |
| D3 | Automations go live on create | create, then immediately PUT `isActive=false` unless the row says Active |
| D4 | Card details on Business step | removed entirely |
| D5 | Inviting customer booking users from Clients step | optional per extra contact, default off. **The primary contact is always invited when the customer is created** (Settings `TenantClientsController.Create` calls `CreateSignInAsync`, no opt-out), so each customer row needs an explicit "this emails <contact>" tick before it is sent |

## API surfaces missing today (candidates for Jacob's MCP write tools)

Steve, 24 Oct: flag these; they can probably be added as part of the agent-access MCP work. Until then each is a "DFRNT does this" checklist item in the dashboard.

| # | Surface | Today | Needed for |
|---|---|---|---|
| G1 | Create depot (`tblBulkRegion`: name, address, GPS, timezone) | Admin Manager only; Routed Ops can only deactivate/reactivate | schedules, distance rates, fleets |
| G2 | Create the tenant's own client file (ClientTypeId 4) | no API (Settings creates type 2 only; NP cascade type 3) | Team step (contacts hang off it), role ownership |
| G3 | Upload tenant logo (`tenantLogo.png` in S3BucketBulk) | read-only everywhere | Business step, booking/portal branding |
| G4 | NZ bulk zone rates (`BulkZoneRate` / `tucRateCode`) | no API; Routed Ops pricing (spec 9 Oct M7/M8) not built | Rates step for NZ tenants |
| G5 | Create a speed (`tucJobType`) from scratch | copy-only, DF Admin | first tenant setup if no seed speeds |
| G6 | Integration Manager fuel surcharges | admin portal calls `/admin/rates/fuel-surcharges` but no backend route | Rates/Integrations |
| G7 | Create-returns-id for extra charges, accessorial charges, unit types | returns `id: null` | any caller that links them next |
| G8 | First-customer site: `SiteId` copied from an existing customer (0 on an empty tenant) and NP cascade needs an existing client | implicit dependency | Clients + Partners on a brand-new tenant |
| G9 | Account status on a client (`ucclAccountStatus`, BlocksBooking) | column exists, no Settings write | Clients |
| G10 | Tenant-callable rate card create + rate import | AdminOnly | tenant self-service on Rates |
| G11 | Automation create honouring `isActive` and `all* = false` scope | not settable on create; scope flags likely stored true | Automations |
| G12 | Tenant system settings (`TblSetting` row 1: company name/address/bank/GST, SMTP + from/reply addresses, admin/enquiry/statement emails, internet root, address validation, map roots) and message templates (`tblSMPPSettings` row 1, incl. the sign-in invite / reset-password subject + body) | Admin Manager System Settings only; no Settings API. **Cheetah's rows are a copy of Urgent's (24 Oct): Auckland PO Box, NZ bank number, smtp.gmail.com as noreply@urgent.co.nz, helpdesk/cs/Statements/recruitment @urgent.co.nz, www.urgent.co.nz, CourierPost address validation as WS.UrgentCouriers, uclsql2 map roots** | Business step (tenant identity) - must be right **before any invite is sent**, because Hub's invite goes through `NET_stpContact_ResetPassword`, which takes its subject/body from `tblSMPPSettings` |

## Milestones

| # | Title | Done when |
|---|---|---|
| M0 | Safety + strip legacy | Anonymous endpoints, AM client, TMS SDK, env creds, card fields gone; fallback auth policy; tenant-scoped sessions; Node 22; builds green |
| M1 | TenantAppClient | Cookie forwarding + XRW + warm-up + error mapping, unit tested against a fake handler |
| M2 | Progress model + UI | StepState, requests, checklist, waiting-on-tenant header; row results shown |
| M3 | Team | roles + tiles + contacts via Settings; invite confirmation; no staff/tblUser |
| M4 | Clients | customers + contacts via Settings with all mandatory fields and lookups; no dummy data |
| M5 | Rates & zones | Settings pricing objects in creation order; explicit clientIds; DF-only items gated |
| M6 | Schedules, couriers, partners, automations | Routed Ops schedules; Settings fleets/couriers/agents/automations |
| M7 | Integrations + app config checklists | deep links per tenant URL; manual ticks |
| M8 | Tests + staging run + handover | xUnit + vitest green; one staging tenant run end to end; Jacob card + Slack |

## Appendix A - calling the apps

| | Settings (configurator) | Routed Ops | Integration Manager |
|---|---|---|---|
| Host | `dfrntdriveconfig.<tenant>[.staging].deliverdifferent.com` | `routedoperations.<tenant>...` | `integrationmanager.<tenant>...` |
| Auth | `.AspNet.SharedCookie`, key ring `/Hub/DataProtection`, app `DeliverDifferent` | same | same, or Bearer JWT |
| CSRF | `X-Requested-With: XMLHttpRequest` on POST/PUT/PATCH/DELETE (else 400 "missing required header") | same | XRW or Bearer |
| Tenant DB | Redis `{tenant}-DfrntDriveConfigurator-Connection`, written only by `GET /` (8 h) | `{tenant}-RoutedOperations-Connection`, `GET /` | fetched from Hub on miss |
| Envelope | 200 DTO or `{success,id,messages[]}`; 400 `{success:false,messages[]}` | `{response}` / 400 `{message}` | DTO |
| Unauth | 302 to PublicPath | 302 | 401 + X-Auth-Redirect |

## Appendix B - write contracts used (develop, 23 Oct)

Settings `origin/develop 3a3fde0`, Routed Ops `25921f4`, IM `6ff7b13`, Hub `master 7b7c7a0`. "req" = server rejects without it.

**Team**
- `POST /api/admin/roles` (TenantStaffOrAdminNoNp + cfg-settings-roles): name req (409 dup), clientTypeIds req >=1 (each <= caller rung), description, tenantClientId (DF Admin only; set to the tenant's type-4 client so tenant staff can edit later). Seeds every `hub-tile-*` row denied.
- `PUT /api/v1/tenant/tile-access/roles/{roleId}/{hub-tile-key}` body `{enabled}` (cfg-settings-tile-access). 204.
- `PUT /api/admin/role-permissions/{roleId}/{key}` `{allowed, accessLevel, clientId:null}` - **AdminOnly**.
- `POST /api/admin/contacts` (ContactAdministration + cfg-team-users|cfg-customers): clientId req (type 2-5, ladder), email req (unique), firstName, lastName, roleIds (must be tagged for client type; others silently dropped), relationshipTypeId, jobTitle, mobile. Side effect: Hub `users/tenant` (or NP route) creates Master user + **invite email**; result in `inviteNotice`. Lookups: `GET /api/admin/contacts/lookups/roles?clientType=N`, `/relationship-types`.

**Clients**
- `POST /api/v1/tenant/clients` (TenantStaffOrAdminNoNp + cfg-customers): name req, code req, address req, suburb req (label "City" in US), city req (label "State" in US), invoiceScheduleId req (`GET .../lookups/invoice-schedules`), paymentTermId req (`GET .../lookups/payment-terms`), primaryContact.firstName + email req (email unique). Optional: unit, extraAddress, postCode, country, latitude/longitude (no server geocode; use `GET .../lookups/address-autocomplete-config` for Places), phones, emails, invoiceMethod (default EMAIL), gstInclusive, notes, jobPrefix, primaryContact.password. Server sets ClientTypeId 2, **SiteId copied from first customer (0 on an empty tenant - to confirm)**, BillingType 3. Side effect: primary contact sign-in + invite.
- `POST /api/v1/tenant/clients/{id}/contacts`: firstName or surname req, email (= username), mobile, jobTitle. Then optional `POST .../contacts/{cid}/access/create-signin` (invite).

**Rates & zones** (`/api/v1/tenant/pricing`, cfg-pricing; AdminOnly marked)
- vehicle-sizes `{name req, cubic/pallet/weight capacity, fuelPercentage (fraction), defaultForBooking}`
- zone-groups `{name req}`; zone-names `{name req, zoneGroupId}`; zone-zips `{zip req, zoneNameId, zoneNumber, applyCongestion}` (one per zip)
- break-types `{name req, unitOfMeasure}`; break-groups `{name req, breakTypeId (send), useAverage, driverPercentage}`; `PUT break-groups/{id}/tiers {breakTypeId, tiers[{startValue, endValue, baseCharge, extraValueRate, incrementUnit, incrementRate, driverPercentage}]}`
- fuel-surcharge-groups `{name req, isIndexed, autoUpdateFrequency, active}`; fuel-surcharges `{start (send), rate (fraction), name, clientId, vehicleSizeId, fuelSurchargeGroupId, end, pumpPrice, driverFuelPercentage, active}`
- extra-charges / accessorial-charges / unit-types: name req, **return id null** (look up by name after)
- zone-rates `{name req, fromZoneNameId, toZoneNameId, speedId, vehicleIds, chargeRate, driverRate, ... clientIds}`; distance-rates `{name req, baseCharge(+Dp), perDistanceUnit(+Dp), distanceIncluded, start/endDistance, depots[], clientIds}` - **clientIds null or [] = all clients**
- rate-cards `{name req, active, speedId, vehicleIds}` **AdminOnly**; rate-spreadsheet import **AdminOnly**
- speeds: copy only, **AdminOnly**
- client links: `PUT {distance|zone|air-freight}-rates/{id}/clients {clientIds}` replaces the set

**Schedules** (Routed Ops, RouteBuilder.Admin = ClientType 4/5, feature ro-schedules-new)
- `POST /api/v2/schedules`: name req, regionId req (depot), dayWindows req >=1 `{dayOfWeek 1-7, startTime, endTime "HH:mm", cutoffDay?, cutoffTime?}`; originType depot|client|direct (default depot); client origin => originRegionId req, isDefault=false, >=1 client; isDefault null = true; pickupDepotId, speedId, clientIds. Lookups `GET /api/schedules/lookups`.
- Depots: **no create API** (Admin Manager only).

**Couriers / partners / automations** (Settings)
- `POST /api/v1/np/fleets` `{name req (<=50, unique), depotId, ...}`; `POST /api/v1/np/fleet` `{firstName req, surName req (pair unique), email req (unique, no existing Master user), password req, code, mobile, vehicleType, courierTypeId (default 2 Master), npAgentId}` - creates Master courier login, no email. `PUT /api/v1/np/fleet/{id}` is a full overwrite (`active` defaults false): GET, merge, PUT.
- `POST /api/v1/tenant/agents` `{name req, isNetworkPartner, contactEmail, primaryContactRoleId (req with email), ...}` - NP client copies site/billing from the first active client; Hub invite.
- `POST /api/automations` (TenantAdministration + cfg-automations): name req (DB), conditions[], actions[], scope; **live on create**; all* scope flags may be stored true even when false is sent (to confirm on staging - then PUT scope).
