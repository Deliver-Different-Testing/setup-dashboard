# Setup Dashboard — getting provisioning off a user's login

> **Date:** 14 October 2026
> **From:** Steve / EasyEA
> **For:** Jacob (agent access / `dfrnt-mcp`), Garry (Hub, infra), Kevin (Setup Dashboard)
> **Status:** findings + proposal. Nothing here is built. Decisions for Steve are in §6.

---

## 1. The problem in one paragraph

The Setup Dashboard reads the tenant database with a service credential already (EF Core
`DespatchContext`, connection string from the master controller registry plus `SQLCredentials`,
cached in Redis). Its **writes** do not. `Services/ProvisioningService.cs` pushes every step to
the Admin Manager API using the signed-in DF staff member's browser cookies
(`.AspNet.SharedCookie` + `hub_session`), captured from the request and replayed
(`SetupController.CaptureRequestCookie` → `AdminManagerClient.LoadCookiesFromRequestAsync`).
If that fails it falls back to a shared human login from env (`DFRNT_USERNAME` /
`DFRNT_PASSWORD`, `ProvisioningService.EnsureAuthenticated`). Both are the "borrowed browser
cookie" pattern the agent-access work exists to remove: unhosted, unrevocable, and
indistinguishable from the human.

Steve's direction (13–14 Oct): fold the dashboard's writes into Jacob's `dfrnt-mcp` work so the
wizard and the agents share one write surface, one journal and one revocation model.

## 2. What ProvisioningService writes today

All Admin Manager, all cookie-authenticated, all `[Authorize(Policy="AdminOnly")]` or
`ExcludeRestrictedGroups` (checked on `adminmanager` master 14 Oct).

| Wizard step | Admin Manager route(s) | Notes |
|---|---|---|
| 1 Team | `POST /api/user` | Creates an Admin Manager user. **To confirm:** does not create `Master.User` in Hub, so the person cannot log in (the gap Hub's `/api/admin/users/tenant` was built to close) |
| 2 Clients | `POST /api/client` | Contacts not pushed |
| 3 Rates | `POST /api/zoneGroup`, `POST /api/zoneName`, `POST /api/rateCard`, `POST /api/breakGroup`, `POST /API/fuel` | Rate card + fuel only. No zone rates, no zone zips, no breaks |
| 4 Couriers | `POST /api/courier` then `POST /api/agent` | |
| 5 Automations | `POST /api/automationRules` | |
| Go live | all of the above in order zones → rates → clients → couriers → users → automations | Idempotent via `session.ProvisionedIds`; no rollback |

Smart Import (`ImportController.Execute`) only writes to the session; the push happens when the
step is saved.

## 3. What exists today for a service (non-user) caller

Checked 14 Oct against gitlab.com/deliver-different (`hub`, `api`, `adminmanager`,
`routed-operations`, `dfrntdrive_configurator`, `dfrntcrm`) and the agent-access spec v4.

### 3.1 Hub `X-Api-Key` service endpoints — exist, in use

`[AllowAnonymous]` controllers gated by a header key from env, rate-limited (`EnableRateLimiting("api")`):

| Route | Key env (Hub side) | Caller today |
|---|---|---|
| `GET /api/tenants/{tenantId}/connection-string` | `PartnerDirectoryApiKey` | every app's connection-string manager |
| `POST /api/admin/users` (NP user) | `ConfiguratorApiKey` | configurator NP cascade (`NpUserInviteService`, header `X-Api-Key` = `HubAdminApiKey`) |
| `POST /api/admin/users/tenant` (tenant / DF-admin user) | `ConfiguratorApiKey` | configurator Team page create cascade |
| `POST /api/admin/users/set-password`, `/send-reset`, `/change-email` | `ConfiguratorApiKey` | configurator Access tab |

Request shape for the two creates: `{ "Email": "...", "CurrentTenantId": 123 }`. Creates the
`Master.User`, sends the invite (held by outbound gating on non-Live tenants).

**This already solves the Team step without a user login.** It is also the sanctioned path:
the configurator's cascade is tucClientContact + role rows + this call.

### 3.2 `api.{tenant}` (public API, JWT bearer) — not a provisioning surface

Symmetric-key JWT (`JWTSecretKey`, `Issuer`, `Audience` env); tokens minted per client contact by
Hub `AccountController.GenerateApiKey`. Controllers: Baggage, Barcodes, BulkRun, Intercom,
JobLabel, Jobs, LibraryScan, Rates (read/quote only), UrgentWS, Webhook. **No create endpoints
for clients, contacts, couriers, agents, zones, rate cards, users or automations.** Spec D6
defers `api` tools to Phase 4. Not useful here.

### 3.3 Admin Manager — cookie only

`Program.cs` L165-197: `Identity.Application` cookie (`.AspNet.SharedCookie`) + `hub_session`.
No API-key or bearer scheme. The write controllers in §2 are policy-protected and policies key on
`UserGroupID`, so any non-cookie caller must still present a staff principal (spec 2.2–2.7,
adminmanager row: `IAgentClaimsEnricher` adds `UserGroupID` from `tblUsers` by `StaffID`).

### 3.4 Routed Operations / configurator — not yet write surfaces for these entities

Routed Operations `ClientsController` is read plus one write (`POST {clientId}/geocode`), policy
`RouteBuilder.Admin`; `ZonesController` is read-only (`RouteBuilder.Polygon`). Configurator has a
second auth scheme (`PortalCourierAuthenticationHandler`) and internal `X-Api-Key` tool endpoints
(PDF overlay), and is where the Team / NP user cascades live. Client-record writes are being
rebuilt in Routed Operations (Steve, 7 Oct) but nothing provisioning-shaped exists yet.

### 3.5 CRM (`dfrntcrm`) — Jacob's service-to-service pattern

`SignUps:ApiKey` (`X-Api-Key`) lets the sign-up page push a lead with no user; tenancy comes from
the root `TenantId` setting. Same header-key pattern as Hub §3.1. A precedent, not a surface for
TMS writes.

### 3.6 The agent-access design (spec v4, 12 Oct) — the target, with one gap

- **Group 2** adds an `AgentToken` JwtBearer scheme to six apps **including adminmanager**:
  app pass `aud=dfrnt-apps`, 15 min, RS256 signed by Hub, claims identical to the cookie's, so
  `[Authorize(Policy="AdminOnly")]` and the UserGroupID policies keep working unchanged.
- The app pass is issued **only** by Hub token-exchange to confidential client `dfrnt-mcp` (one
  secret per tenant deployment), in exchange for an agent pass a **human** consented to
  (authorization code + PKCE, `ClientTypeId` 4 or 5). D5, D11.
- **Group 10** (after Group 9): writes need `scope=write` on the exchange, a server-verified
  confirmation token, a journal row in `McpChangeJournal` (login `DfrntMcpServer`, insert-only),
  restore-exactness proven in CI. First write tools: **rates, then zones and zips** (10.5).
  Never delete, never accounting / payments / messages.
- **Gap:** there is no service identity. Every pass has a human subject. That is right for
  agents and right for a DF staffer running the wizard (their Hub login *is* the consent). It
  does not cover an unattended run (the July agent-led onboarding prototype, or a CI-driven
  tenant build). The spec has no `client_credentials` grant and no system staff record.

## 4. Options

| | Option | Removes user login? | Fits the spec | Cost | Verdict |
|---|---|---|---|---|---|
| A | Keep cookie forwarding; delete the `DFRNT_USERNAME`/`PASSWORD` fallback | No, but removes the shared human login | Neutral | Hours | **Do now** (Kevin). The fallback is the actual hazard; cookie forwarding of the signed-in staffer is tolerable until C |
| B | Per-tenant API key in Admin Manager (the March PLANNING.md "Phase 2 auth upgrade") | Yes | **Conflicts**: adds a second scheme to an app being retired, outside the journal, no revocation story | Days | Reject |
| C | Dashboard becomes an OAuth client of Hub and its provisioning becomes **`dfrnt-mcp` write tools**: `client_create`, `courier_create`, `zone_create`+`zone_zips_add`, `rate_card_create`, `automation_rule_create`; Team via Hub §3.1 | Yes (cookie gone; the staffer consents once, pass is revocable, every write journaled with rollback) | Direct | Rides Groups 2 + 10; dashboard-side work ≈ 3–4 days once tools exist | **Target** |
| D | Service grant for unattended runs: Hub `client_credentials` for confidential clients (`setup-dashboard`, later an onboarding agent) → app pass with `auth_kind=service`, subject = a per-tenant **DF System** staff record (`ClientTypeId` 5), `scope=write`, journaled with `AgentName="setup-dashboard"` | Yes, fully | **New decision** (proposed D22) | Hub: ~2 days inside Group 1; one seeded staff row per tenant at provisioning | Needed only if onboarding is to run without a DF person present |

**Recommendation:** A now, C as the target, D only when Steve wants unattended onboarding. Do
not build B.

## 5. What C means in practice

1. **Team step → Hub now.** Replace `ProvisionUsersAsync`'s `POST /api/user` with
   `POST /api/admin/users/tenant` (`X-Api-Key` = `HubAdminApiKey`, same env the configurator
   holds) plus the configurator's contact + role cascade. No user login involved. Can ship before
   anything in the MCP plan. **To confirm with Garry:** whether the dashboard should hold
   `ConfiguratorApiKey` or get its own key (the Hub comment argues one key per trust boundary).
2. **Rates and zones → first write tools (10.5).** The wizard's rate card, break group, fuel,
   zone group, zone name and zip writes map one-to-one onto the planned first write tools.
   Fold the wizard's payloads into their fixtures so the tools cover the wizard's shapes from day
   one. This also fixes the wizard's thin rates provisioning (§2) by giving it the full family.
3. **Clients, couriers, automations → next write tools**, in that order, against the apps that
   own them after the Admin Manager retirement (clients: Routed Operations; couriers/agents:
   configurator; automations: to decide). Each needs the Group 10 round-trip test; the wizard
   gets journal + rollback for free, which replaces its own `ProvisionedIds` idempotency.
4. **Go live becomes one batch.** `POST session/{id}/go-live` issues the tool calls under one
   `BatchId`, so a failed go-live is a single journaled rollback instead of a partial tenant.
5. **Dashboard as a client.** Register `setup-dashboard` as a confidential OpenIddict client of
   each tenant Hub (Group 1.4 seeder). The DF staffer's Hub sign-in on the dashboard becomes the
   consent (screen names the dashboard, not an AI vendor); the dashboard holds the agent pass
   server-side and lets `dfrnt-mcp` exchange it. `ProvisioningService` shrinks to an MCP client
   (official C# SDK) or a direct reference to the shared tool library (D21 "thin tools over a
   shared library that reuses the apps' own C#"). Prefer the library in-process: one hop fewer,
   same journal.
6. **Delete** `AdminManagerClient`'s cookie replay and the env-credential login once 1–5 land.
   The 183-method `Services/TmsApi` SDK stays as the inventory of Admin Manager quirks for the
   tool port (spike 0.5), then goes.

### Proposed text for the agent-access spec (for Steve to ratify, then paste into v4 §1.1 / §3)

> **D22 (proposed, Steve 14 Oct):** The Setup Dashboard is the first non-AI write client of
> `dfrnt-mcp`. Its provisioning writes (zones, zips, rate cards, breaks, fuel, clients, couriers,
> automation rules) are write tools under Group 10 rules; Team users go through Hub
> `/api/admin/users/tenant`. The dashboard is a confidential OpenIddict client per tenant; the DF
> staffer's Hub login is the consent. Unattended onboarding, if wanted, needs a service grant
> (`client_credentials`, `auth_kind=service`, per-tenant DF System staff record) — separate
> decision, not in Phase 1 or 2.
>
> **10.7 Setup Dashboard payloads.** The rates / zones write-tool fixtures include the Setup
> Dashboard's `RateConfig` and `ZoneRateRow` shapes (`SetupDashboard.Api/Models/Session.cs`) so
> the wizard is covered by the same round-trip test.

## 6. Decisions for Steve

1. Approve A now (delete the env-credential fallback) — yes / no.
2. Approve C as the target and D22 into Jacob's spec — yes / no. If yes, I push the D22 / 10.7
   text to `dfrnt-ops` branch `docs/agent-access-mcp-spec` and post in `#mcpdiscussion`.
3. Is unattended onboarding (option D) wanted in the next two quarters? If not, D22 stays as
   written and no service grant is built.
4. Team step via Hub `/api/admin/users/tenant` now (Kevin, with Garry on the key) — yes / no.

## 7. Evidence (as read 14 Oct 2026)

- `setup-dashboard` (gitlab master): `SetupDashboard.Api/Services/ProvisioningService.cs` L5-14 (routes), L454-473 (`EnsureAuthenticated`), `Controllers/SetupController.cs` L610-735 (go-live), `Services/AdminManagerClient.cs` (cookie replay), `Program.cs` L54-144 (shared cookie, Redis, `DespatchContext` factory).
- `hub` master: `Controllers/AdminUsersController.cs` L14-60 (`X-Api-Key`, `ConfiguratorApiKey`), `Controllers/TenantsController.cs` L1-45 (`connection-string`), `Controllers/AccountController.cs` L1025-1101 (`GenerateApiKey`).
- `api` master: `AuthenticationExtensions.cs` L22-38; `Controllers/` listing.
- `adminmanager` master: `Program.cs` L165-197; `API/Controllers/{User,Client,Courier,Agent,ZoneGroup,ZoneName,RateCard,BreakGroup,Fuel,AutomationRules}Controller.cs` attributes.
- `routed-operations` master: `API/Controllers/ClientsController.cs` L25-76, `ZonesController.cs` L14-18.
- `dfrntdrive_configurator` master: `Core/Application/Services/Common/NpUserInviteService.cs` L14-256.
- `dfrntcrm` develop: `src/DfrntCrm.Api/Program.cs` L70-76, `Core/Helpers/SignupLeadsOptions.cs`.
- `dfrnt-ops` branch `docs/agent-access-mcp-spec`: `docs/specs/2026-10-09-agent-access-mcp-spec.md` §1.1 D5/D6/D10/D11/D13/D21, §2, Group 1.4/1.9, Group 2.1–2.7, Group 10.1–10.6, §4.
