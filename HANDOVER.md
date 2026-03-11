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

Every step that has tabular data (Steps 1-4) has a **"📄 Import from CSV/Excel"** button. This is the smart uploader:

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

## What Needs Doing

### Priority 1 — Wire Admin Manager Push
The `AdminManagerClient` has the auth pattern working. Now each step save endpoint needs to actually call the Admin Manager API to create the records. The MCP server's tool files (`dfrnt-mcp-server/src/tools/*.ts`) document every endpoint:

| Step | MCP Tool File | Key Endpoints |
|------|--------------|---------------|
| Clients | `clients.ts` | `POST /api/client` |
| Contacts | `contacts.ts` | `POST /API/contact`, `POST /API/clientContact` |
| Zones | `zones.ts` | `POST /api/zoneName`, `POST /api/zoneZip` |
| Rates | `rates.ts` | `POST /api/rateCard`, `POST /api/zoneRate` |
| Couriers | `agents.ts` | `POST /api/agent` (couriers are "agents" in the API) |
| Services | `services.ts` | `POST /api/service`, `POST /api/speed` |

### Priority 2 — Session Persistence
Replace in-memory `SessionStore` with database-backed storage so sessions survive backend restarts.

### Priority 3 — Real Validation
Wire the validation endpoints (`/validate/username`, `/validate/client-code`, etc.) to actually call Admin Manager and check for duplicates.

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
