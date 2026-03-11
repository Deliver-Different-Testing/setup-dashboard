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
5. Automations (event-driven rules)
6. Integrations (Hub link)
7. App Config (Hub link)
8. Partners (Hub link)
9. Training (gamified onboarding challenges)

Steps 6-8 are just launch pads — they link to existing Hub UI. Don't build full config forms for those.

---

## Getting It Running

### Frontend
```bash
cd setup-dashboard
npm install
npm run dev          # → http://localhost:5173
```

### Backend
```bash
cd setup-dashboard/backend
dotnet run           # → http://localhost:3001
```

The frontend calls the backend at `http://localhost:3001/api` by default. Override with `VITE_API_URL` env var if needed.

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
In `backend/Models/SmartUpload.cs`, each entity type defines its fields and aliases. To add a new importable type:
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

## Architecture Rule

**The Setup Dashboard has NO database.** All permanent data goes to the Admin Manager API via the backend. The in-memory `SessionStore` is just a temp shopping cart while the user configures things.

Future: Replace `SessionStore` with Redis or SQL if session persistence across backend restarts is needed.

---

## Key Files to Know

| File | What It Does |
|------|-------------|
| `src/lib/api.ts` | Every single API call the frontend makes — start here |
| `src/store.ts` | Zustand state store — wizard state, current step, session data |
| `src/components/SmartImport.tsx` | The reusable smart upload modal |
| `backend/Services/SmartUploaderService.cs` | Column matching + validation engine |
| `backend/Services/AdminManagerClient.cs` | Cookie auth to Admin Manager |
| `backend/Models/SmartUpload.cs` | Entity field definitions + aliases |
| `backend/Controllers/ImportController.cs` | Upload/detect/preview/execute endpoints |
| `backend/Controllers/SetupController.cs` | Session CRUD + step save endpoints |

---

## TMS API SDK — The Big Piece

The entire MCP server (Mike's 147 tools) has been ported into C# service classes at `backend/Services/TmsApi/`. This is a complete SDK for the Admin Manager API.

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

1. Add the DTO to `Models/TmsApi/{Domain}Models.cs`
2. Add the method to the appropriate service in `Services/TmsApi/`
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
Replace in-memory `SessionStore` with database-backed storage so sessions survive backend restarts.

### Priority 3 — Real Validation
Wire `/validate/username`, `/validate/client-code` etc. to call `tms.Clients.GetAllAsync()` / `tms.System.GetUsersAsync()` and check for duplicates.

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

```bash
cd setup-dashboard
npm run build
npx gh-pages -d dist
```

Backend is not yet deployed — runs locally during DF onboarding sessions. Future: could deploy alongside Admin Manager or as a standalone service.

---

## Important Constraints

- **No "30-minute setup guarantee"** — operators know their business is complex, don't patronise them
- **Migration: tenant exports own data** from competitor TMS — DF never accesses competitor systems (legal safeguard)
- **Steps 6-8 are Hub launch pads** — links to existing UI, not full config forms
- **Auto-Mate IS the help system** — no separate help panel needed
- **This is a separate repo from CSP** — it's a DF tool, not a tenant tool

See `IMPLEMENTATION.md` for full API reference and code reuse documentation.
