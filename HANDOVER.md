# Setup Dashboard — Handover for Kevin

> **Date:** 11 March 2026
> **From:** Steve / EasyEA
> **To:** Kevin

---

## What Is This?

The Setup Dashboard is a **DF-internal tool** used by DFRNT staff when onboarding new tenants. It's NOT a tenant self-service tool — a DF person sits with the operator and walks through the wizard together.

**10 steps:**
0. Business Profile (company details, region, branding)
1. Team (invite staff, assign roles) — **Smart Import**
2. Clients (add clients + contacts) — **Smart Import**
3. Rates (zones, rate cards, pricing) — **Smart Import**
4. Couriers/Drivers (fleet setup) — **Smart Import**
5. Automations (event-driven rules) — **Smart Import**
6. Integrations (Hub link) — **Smart Import**
7. App Config (Hub link) — **Smart Import**
8. Partners (Hub link) — **Smart Import**
9. Training (gamified onboarding) — **Smart Import**

Steps 6-8 are just launch pads — they link to existing Hub UI. Don't build full config forms for those.

---

## Getting It Running

### Visual Studio (Recommended)
```bash
# Open SetupDashboard.sln → F5
# MSBuild runs "npm run build" → output to wwwroot/setup-dashboard/
# .NET starts on https://localhost:7200
# Browser opens https://localhost:7200/setup-dashboard/
```

### Manual (Terminal)
```bash
# Backend (builds frontend automatically on first run)
cd SetupDashboard.Api
dotnet run           # → https://localhost:7200 / http://localhost:5200

# For frontend hot reload (separate terminal)
cd SetupDashboard.Api/ClientApp
npm install
npm run dev          # → http://localhost:5173/setup-dashboard/
```

When using `npm run dev`, the Vite dev server proxies `/api` calls to `http://localhost:5200`.

### Environment Variables

Set in `Properties/launchSettings.json` for dev (gitignored — contains local DB/Redis creds). For staging/prod, vars are injected from per-tenant `{TENANT}_STAGING_ENV` / `{TENANT}_PROD_ENV` GitLab CI file variables.

| Variable | Purpose |
|----------|---------|
| `SQLHealthCheckConnection` | Health check DB connection (master-controller-seed) |
| `MasterSQLConnection` | Master controller DB connection (tenant registry) |
| `SQLCredentials` | SQL credentials appended to tenant connection strings |
| `RedisConfig` | Redis connection string (in-memory fallback in dev) |
| `Domain` | Cookie domain for shared auth (`local.deliverdifferent.com` in dev) |
| `PublicPath` | Hub login redirect URL |

### Without Backend (Offline Mode)
The frontend has localStorage fallback — it will work without the backend running, but data won't persist across sessions or push to Admin Manager.

---

## Smart Uploader — The Key Feature

**Every step (0-9)** has a **"📄 Smart Import from Competitor TMS"** button. This is the smart uploader:

### How It Works
1. User uploads a CSV or Excel file (drag-drop or file picker)
2. Backend auto-detects the source system (Key Software, Datatrac, Elite EXTRA, etc.)
3. Columns are fuzzy-matched to our fields with confidence scores (100% exact, 95% alias, 60-94% fuzzy)
4. User reviews the mapping and can manually adjust
5. Data is validated (required fields, formats, duplicates)
6. Preview shown with any warnings
7. User confirms → data imported into the wizard step

### Competitor System Detection
The uploader recognizes CSV exports from these competitor TMS platforms:
- **Key Software** — `KS_` prefixed columns
- **Datatrac** — `DT_` prefixed columns
- **Crown** — `CRW_` prefixed columns
- **e-Courier** — `EC_` prefixed columns
- **Elite EXTRA** — standard column names
- **CXT** — standard column names

When detected, column mappings are pre-configured for that system's export format. This is the migration play — operators export their own data from their old TMS, we import it cleanly.

### Adding New Entity Types
In `SetupDashboard.Api/Models/SmartUpload.cs`, each entity type defines its fields and aliases. To add a new importable type:
1. Add a new case in `EntityFieldDefinitions` with field names, display names, required flags, and aliases
2. Add the entity type string to the `entityType` parameter in `ImportController.cs`
3. Add a SmartImport button to the relevant step component

---

## Admin Manager API Connection

The backend talks to the DFRNT Admin Manager using cookie-based auth (same pattern as Mike's MCP server).

### Quickest Setup — Share MCP Sessions
If the MCP server is already authenticated on your machine:
```bash
cd setup-dashboard/backend
ln -s ../../dfrnt-mcp-server/auth auth
```

### Manual Login
Set env vars:
```bash
export DFRNT_USERNAME=your-email@example.com
export DFRNT_PASSWORD=your-password
```

The backend auto-logins to Admin Manager using the same 4-step hub flow the MCP server uses.

### Auth Flow (for reference)
1. GET hub login page → extract `__RequestVerificationToken` + anti-forgery cookie
2. POST credentials to hub → get `.AspNet.SharedCookie`
3. POST `/API/Login/Validate` on Admin Manager → get `hub_session` cookie
4. GET dispatch URL → establish dispatch session
5. Save cookies to `auth/{env}.json`

---

## Architecture

### Database (SQL Server via Entity Framework Core)
The Setup Dashboard now connects to the **same SQL Server databases** as the other DFRNT apps (AdminManager, WebAPI, etc.) using the shared multi-tenant pattern:

- **SetupDashboardDbContext** — slim context with ~20 entities needed by the setup wizard (clients, agents, zones, rates, users, services, automations, lookups). Entity files in `Core/Domain/Entities/`. Add more entities to `Entities/` and register in the DbContext as needed.
- **DynamicDespatchDbContextFactory** — resolves tenant connection strings from Redis cache at runtime
- **ConnectionStringManager** — thread-safe Redis-backed cache for tenant connection strings
- **LoginController** — validates hub shared cookie, extracts `CurrentTenantID` claim, caches connection string

### Authentication (Hub Shared Cookie)
Uses the same cookie-based auth as AdminManager:
- Shared cookie name: `.AspNet.SharedCookie`
- Data Protection keys shared via `SetApplicationName("DeliverDifferent")`
- Login flow: Hub login → shared cookie → LoginController validates → caches connection string
- Session cookie: `hub_session` (24h timeout)

### Session Store
The in-memory `SessionStore` is still used for wizard state (shopping cart). Permanent data goes to the Admin Manager API or directly to the tenant database via EF Core.

---

## Key Files to Know

| File | What It Does |
|------|-------------|
| `SetupDashboard.Api/ClientApp/src/lib/api.ts` | Every single API call the frontend makes — start here |
| `SetupDashboard.Api/ClientApp/src/store.ts` | Zustand state store — wizard state, current step, session data |
| `SetupDashboard.Api/ClientApp/src/components/SmartImport.tsx` | The reusable smart upload modal |
| `SetupDashboard.Api/Program.cs` | DI, auth, EF Core, Redis, health checks |
| `SetupDashboard.Api/Controllers/LoginController.cs` | Hub cookie auth + connection string caching |
| `SetupDashboard.Api/Controllers/SetupController.cs` | Session CRUD + step save endpoints |
| `SetupDashboard.Api/Controllers/ImportController.cs` | Upload/detect/preview/execute endpoints |
| `SetupDashboard.Api/Services/SmartUploaderService.cs` | Column matching + validation engine |
| `SetupDashboard.Api/Services/AdminManagerClient.cs` | Cookie auth to Admin Manager API |
| `SetupDashboard.Api/Core/Domain/DynamicDespatchDbContextFactory.cs` | Multi-tenant EF context |
| `SetupDashboard.Api/Core/Domain/ConnectionStringManager.cs` | Redis connection string cache |
| `SetupDashboard.Api/Models/SmartUpload.cs` | Entity field definitions + aliases |

---

## TMS API SDK — The Big Piece

The entire MCP server (Mike's 147 tools) has been ported into C# service classes at `SetupDashboard.Api/Services/TmsApi/`. This is a complete SDK for the Admin Manager API.

### How to Use It

```csharp
// 1. Get a client for the environment
var client = _clientFactory.Create("medical-staging");

// 2. Create a service provider (gives you all 15 services)
var tms = new TmsApiServiceProvider(client);

// 3. Call any API
var clients = await tms.Clients.GetAllAsync();
var newZone = await tms.Zones.CreateAsync(new Zone { Name = "Zone 1" });
await tms.Zones.AddZipToZoneAsync(newZone.Id, new ZoneZip { ZipCode = "2010" });
```

### Services Available

| Service | What It Does | Method Count |
|---------|-------------|-------------|
| `ZoneService` | Zones, zone groups, zone zips | 20 |
| `RateService` | Rate cards, breaks, zone rates, distance rates | 32 |
| `AgentService` | Agents (couriers), vehicles, cargo facilities | 21 |
| `ClientService` | Clients, couriers, staff | 16 |
| `ContactService` | Contacts, client-contact links | 12 |
| `ServiceConfigService` | Services, speeds, speed groupings | 11 |
| `SystemService` | Read-only lookups (suburbs, users, settings) | 23 |
| `ExtraChargeService` | Extra charges / accessorials | 12 |
| `AutomationRuleService` | Automation rules | 7 |
| `HolidayService` | Holidays | 6 |
| `FuelService` | Fuel surcharge rates | 5 |
| `JobService` | Dispatch jobs | 10 |
| `LocationService` | Locations/suburbs | 4 |
| `NotificationService` | Notification templates | 4 |

### API Quirks to Watch For

These are already handled in the SDK, but know about them:

1. **`/API/` vs `/api/`** — some endpoints use capital `API`. The SDK handles this per-method, but if you add new endpoints, check the MCP source.
2. **Zone zip GET returns id:0** — the SDK uses POST search instead. Don't try to fix this.
3. **Update = GET → strip → merge → POST** — don't just POST new data, you'll lose existing fields. All `UpdateAsync()` methods do this correctly.
4. **Couriers are "agents" in the API** — `AgentService` handles courier CRUD. Confusing but that's the terminology.
5. **Speed create needs `groupingId`** — defaults to 1 (Excelerator). Don't forget this field.

### Common Operations (copy-paste examples)

**Set up a new client with contacts:**
```csharp
var client = await tms.Clients.CreateAsync(new Client { Name = "Acme", Code = "ACME" });
var contact = await tms.Contacts.CreateAsync(new Contact { FirstName = "John", LastName = "Doe", Email = "john@acme.com" });
await tms.Contacts.LinkToClientAsync(client.Id, contact.Id, isPrimary: true);
```

**Set up zones with zips:**
```csharp
var zone = await tms.Zones.CreateAsync(new Zone { Name = "CBD", GroupId = 1 });
await tms.Zones.AddZipToZoneAsync(zone.Id, new ZoneZip { ZipCode = "1010", Location = "Auckland CBD" });
// Bulk: add many zips at once
await tms.Zones.BulkAddZipsToZoneAsync(zone.Id, zipList, batchSize: 50);
```

**Create rate card with zone rates:**
```csharp
var card = await tms.Rates.CreateRateCardAsync(new RateCard { Name = "Standard", ServiceId = 1 });
await tms.Rates.CreateZoneRateAsync(new ZoneRate { RateCardId = card.Id, ZoneId = zone.Id, Rate = 15.50m });
```

### Adding New Endpoints

1. Add the DTO to `SetupDashboard.Api/Models/TmsApi/{Domain}Models.cs`
2. Add the method to the appropriate service in `SetupDashboard.Api/Services/TmsApi/`
3. Use `GetAsync<T>()`, `PostAsync<T>()`, `PutAsync<T>()`, `DeleteAsync()` from `TmsServiceBase`
4. Check the MCP source (`dfrnt-mcp-server/src/tools/`) for the exact endpoint path and any quirks
5. Watch the `/API/` vs `/api/` casing

---

## What Needs Doing

### Priority 1 — Wire Import Execute to TMS SDK
The TMS SDK is fully built. Now `ImportController.Execute` needs to create a `TmsApiServiceProvider` and call the appropriate service when the user confirms an import. Example flow:
- User uploads clients CSV → detect → preview → execute
- Execute calls `tms.Clients.CreateAsync()` for each row
- Use bulk batching for large imports

### Priority 2 — Session Persistence
Replace in-memory `SessionStore` with database-backed storage (EF Core + DespatchContext is now wired up) so sessions survive backend restarts.

### Priority 3 — Real Validation
Wire `/validate/username`, `/validate/client-code` etc. to call `tms.Clients.GetAllAsync()` / `tms.System.GetUsersAsync()` and check for duplicates.

### Priority 4 — Direct DB Operations
Use the new EF Core DespatchContext for operations that benefit from direct database access rather than going through the Admin Manager API (e.g., bulk reads, lookups, reporting).

---

## Design

DFRNT design system:
- **Primary:** `#0d0c2c` (dark navy)
- **Accent:** `#3bc7f4` (cyan)
- **Background:** `#f4f2f1` (light grey)
- **Font:** Inter / DM Sans

Auto-Mate (the chat sidebar) should be light theme — not dark `#0d0c2c`. Dark mode can come later.

---

## Deploy

Deploys to AWS EKS via the standard DFRNT GitLab CI pipeline (Auto DevOps + Helm). The frontend is built into the .NET app's `wwwroot/setup-dashboard/` by the `NpmBuild` MSBuild target during `dotnet publish`, then the whole thing ships as a single container image.

- `.gitlab-ci.yml` → one-line include of `urgent-couriers/ci-templates`
- `Dockerfile` → multi-stage SDK 10.0 + Node 20 → ASP.NET 10.0 runtime
- `.gitlab/auto-deploy-values.yaml` + `.gitlab/{tenant}-{env}-auto-deploy-values.yaml` → Helm values per tenant × env
- Per-tenant env vars (`K8S_SECRET_*` lines) live in the `{TENANT}_STAGING_ENV` / `{TENANT}_PROD_ENV` GitLab CI file variables; default/baseline values are individual `K8S_SECRET_*` env_vars at `*` scope.
- DataProtection keys → AWS SSM (`/Hub/DataProtection`), accessed via EKS Pod Identity.

For local dev, just F5 in Visual Studio.

---

## Important Constraints

- **No "30-minute setup guarantee"** — operators know their business is complex, don't patronise them
- **Migration: tenant exports own data** from competitor TMS — DF never accesses competitor systems (legal safeguard)
- **Steps 6-8 are Hub launch pads** — links to existing UI, not full config forms
- **Auto-Mate IS the help system** — no separate help panel needed
- **This is a separate repo from CSP** — it's a DF tool, not a tenant tool

See `IMPLEMENTATION.md` for full API reference and code reuse documentation.
