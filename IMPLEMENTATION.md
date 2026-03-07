# DFRNT Setup Dashboard — IMPLEMENTATION.md

> **Repo**: `Deliver-Different-Testing/setup-dashboard`
> **Live**: https://deliver-different-testing.github.io/setup-dashboard/
> **Purpose**: Internal DF tool for onboarding new tenants. NOT customer self-service.
> **Stack**: React 19 + Vite 7 + Tailwind 4 (frontend) | Express 4 + TypeScript + SQLite (backend)

---

## Claude Code — Getting Started

If you're an AI coding agent (Claude Code, Cursor, etc.), follow these steps to get oriented:

### 1. Read this file first
This is your map. Don't start coding until you understand the architecture.

### 2. Understand the 3-layer architecture
```
React Frontend (GitHub Pages)
    ↓ fetch() calls
Express Backend (localhost:3001)
    ↓ dual auth (Bearer JWT + Cookie)
DFRNT TMS API (per-tenant instances)
```

### 3. Key files to read in order
1. `IMPLEMENTATION.md` — this file (architecture, data model, API reference)
2. `src/store.ts` — all frontend state and the `saveStep()` action
3. `src/App.tsx` — wizard flow, step navigation, session init
4. `backend/src/api-client.ts` — dual auth client (Bearer + Cookie)
5. `backend/src/services/database.ts` — SQLite schema, all CRUD functions
6. `backend/src/services/smart-import.ts` — competitor detection + field mapping
7. `backend/src/routes/index.ts` — all API route mounting + session management
8. `MIGRATION-MAPPING.md` — competitor TMS column mappings

### 4. Development setup
```bash
# Frontend
cd setup-dashboard
npm install
npm run dev          # → http://localhost:5173

# Backend (separate terminal)
cd setup-dashboard/backend
npm install
cp .env.example .env # → fill in credentials
npm run dev          # → http://localhost:3001
```

### 5. Environment variables (backend/.env)
```
DFRNT_ENVIRONMENT=urgent-staging     # Which tenant to connect to
DFRNT_USERNAME=steve@urgent.co.nz   # Hub login (cookie auth for admin manager)
DFRNT_PASSWORD=<password>           # Hub password
DFRNT_BEARER_TOKEN=<jwt>            # External API token (from Hub → Account Settings)
DFRNT_API_BASE=https://api.urgent.staging.deliverdifferent.com
PORT=3001
```

### 6. Rules
- **DFRNT design system**: Primary #0d0c2c (navy), Cyan #3bc7f4, Light Grey #f4f2f1, Inter font
- **HashRouter** required (GitHub Pages deployment)
- **No `rm`** — use `trash` for deletions
- Steps 6-8 are Hub launch pads (links), not full configuration forms
- The setup dashboard is a **separate repo** from CSP — don't mix them
- NZ vs US field localization: Suburb↔City, Region↔State, PostCode↔ZipCode

---

## Architecture Overview

### Frontend (React 19 + Vite 7 + Tailwind 4)
- **10-step setup wizard** with progress bar and Auto-Mate chat sidebar
- **Zustand store** manages all state + API integration
- **Steps 0-5**: Full interactive forms that save to backend API
- **Steps 6-8**: Hub launch pad cards (links to existing Hub UI)
- **Step 9**: Gamified training arena with XP, challenges, leaderboards
- **SmartImport component**: 4-step import wizard (Upload → Detect → Map → Preview)
- **Deployed to GitHub Pages** via `npx gh-pages -d dist`

### Backend (Express 4 + TypeScript)
- **Dual auth API client**: Bearer JWT for external API + Cookie auth for admin manager
- **SQLite persistence**: Sessions, entity tracking, import history, training progress
- **Smart import engine**: Auto-detect competitor TMS, fuzzy column matching, transforms
- **9 route files**: One per wizard step + import + health + session management
- **5 service files**: Database, setup orchestrator, smart import, client import, courier/zone/rate setup

### DFRNT TMS (target system)
- **Admin Manager** (`adminmanager.{tenant}.deliverdifferent.com`): Cookie auth, CRUD for clients/couriers/zones/users/automations
- **External API** (`api.{tenant}.deliverdifferent.com`): Bearer JWT auth, jobs/rates/webhooks/labels
- **10 environments**: urgent-staging, medical-staging/prod, otg-staging/prod, mpf-staging/prod, am-staging, crossroads-staging, dfrnt-staging

---

## File Structure

```
setup-dashboard/
├── src/                              # React frontend
│   ├── main.tsx                      # Entry point (HashRouter)
│   ├── App.tsx                       # 10-step wizard, session init, navigation
│   ├── store.ts                      # Zustand state (446 lines)
│   ├── lib/
│   │   └── api.ts                    # Frontend API client (fetch → backend)
│   ├── components/
│   │   ├── Header.tsx                # App header with DFRNT branding
│   │   ├── ProgressBar.tsx           # 10-step progress indicator
│   │   ├── ChatSidebar.tsx           # Auto-Mate AI chat sidebar
│   │   ├── SmartImport.tsx           # 4-step import wizard modal (336 lines)
│   │   ├── Pill.tsx                  # Selectable pill/tag component
│   │   ├── Toggle.tsx                # Toggle switch component
│   │   └── steps/
│   │       ├── Step0Business.tsx     # Company profile, geography, verticals
│   │       ├── Step1Team.tsx         # Team members with roles
│   │       ├── Step2Clients.tsx      # Client list + CSV upload + Smart Import
│   │       ├── Step3Rates.tsx        # Rate card, zone pricing, weight breaks
│   │       ├── Step4Couriers.tsx     # Drivers + QR code + Smart Import
│   │       ├── Step5Automations.tsx  # Notification/automation toggles
│   │       ├── Step6Integrations.tsx # Hub launch pad (Xero, QB, Webhooks, API Keys)
│   │       ├── Step7AppConfig.tsx    # Hub launch pad (Driver App, Profiles, Branding)
│   │       ├── Step8Partners.tsx     # Hub launch pad (A&P Network, Overflow)
│   │       └── Step9Training.tsx     # Gamified training (315 lines)
│   └── data/
│       └── chatMessages.ts           # Auto-Mate chat messages per step
│
├── backend/                          # Express API
│   ├── .env.example                  # Environment variable template
│   ├── package.json                  # Dependencies
│   ├── tsconfig.json                 # TypeScript config
│   ├── data/                         # SQLite database (gitignored)
│   │   └── setup-sessions.db
│   └── src/
│       ├── index.ts                  # Server entry, client init, CORS
│       ├── api-client.ts             # Dual auth client (497 lines)
│       ├── middleware/
│       │   └── error-handler.ts      # Express error middleware
│       ├── routes/
│       │   ├── index.ts              # Route mounting, session CRUD (120 lines)
│       │   ├── health.ts             # GET /setup/health
│       │   ├── business.ts           # POST /setup/business (Step 0)
│       │   ├── team.ts               # POST /setup/team (Step 1)
│       │   ├── clients.ts            # POST /setup/clients + /clients/import (Step 2)
│       │   ├── rates.ts              # POST /setup/rates (Step 3)
│       │   ├── couriers.ts           # POST /setup/couriers (Step 4)
│       │   ├── automations.ts        # POST /setup/automations (Step 5)
│       │   ├── import.ts             # Smart import endpoints (260 lines)
│       │   ├── integrations.ts       # Stub (Step 6 — managed in Hub)
│       │   ├── app-config.ts         # Stub (Step 7 — managed in Hub)
│       │   └── partners.ts           # Stub (Step 8 — managed in Hub)
│       ├── services/
│       │   ├── database.ts           # SQLite init + CRUD (390 lines)
│       │   ├── setup-orchestrator.ts # Session management, legacy compat (110 lines)
│       │   ├── smart-import.ts       # Competitor detection + mapping (540 lines)
│       │   ├── client-import.ts      # CSV parsing + bulk client creation (111 lines)
│       │   ├── courier-setup.ts      # Courier + agent creation (95 lines)
│       │   ├── zone-setup.ts         # Zone group + zone creation (86 lines)
│       │   └── rate-setup.ts         # Rate card + breaks + fuel (118 lines)
│       └── types/
│           └── api.ts                # Environment configs, response types (158 lines)
│
├── IMPLEMENTATION.md                 # This file
├── MIGRATION-MAPPING.md              # Competitor column mappings
├── vite.config.ts                    # Vite config (base: /setup-dashboard/)
├── tailwind.config.ts                # Tailwind config
└── package.json                      # Frontend dependencies
```

---

## Data Model — SQLite Schema

Database file: `backend/data/setup-sessions.db` (auto-created on first run)

### `setup_sessions` — Setup wizard sessions
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| environment | TEXT | e.g. 'urgent-staging' |
| status | TEXT | 'active' / 'completed' / 'rolled_back' / 'abandoned' |
| bearer_token | TEXT | Optional JWT for external API |
| api_base_url | TEXT | Optional external API base URL |
| business_data | TEXT | JSON blob of Step 0 data |
| current_step | INTEGER | Last completed step (0-9) |
| completed_steps | TEXT | JSON array e.g. `[0,1,2,3]` |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |
| completed_at | TEXT | When session finished |
| created_by | TEXT | Email of DF staff member |

### `session_entities` — Entity tracking for rollback
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| session_id | TEXT FK | → setup_sessions.id |
| entity_type | TEXT | 'client' / 'user' / 'courier' / 'agent' / 'zone' / 'zone_group' / 'rate_card' / 'break_group' / 'fuel_surcharge' / 'automation_rule' |
| entity_id | INTEGER | TMS entity ID (for rollback DELETE) |
| entity_name | TEXT | Human-readable name for logs |
| step_number | INTEGER | Which wizard step created this |
| created_at | TEXT | ISO timestamp |

Unique constraint: `(session_id, entity_type, entity_id)`

### `import_history` — Audit trail of CSV/Excel imports
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| session_id | TEXT FK | → setup_sessions.id |
| import_type | TEXT | 'clients' / 'drivers' / 'rates' / 'zones' |
| source_system | TEXT | 'CXT Software' / 'Key Software' / etc. |
| source_filename | TEXT | Original uploaded filename |
| total_rows | INTEGER | |
| success_count | INTEGER | |
| failed_count | INTEGER | |
| field_mappings | TEXT | JSON of the column mappings used |
| errors | TEXT | JSON array of error messages |
| created_at | TEXT | ISO timestamp |

### `training_progress` — Gamified training state
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| session_id | TEXT FK | → setup_sessions.id |
| user_email | TEXT | Team member email |
| user_name | TEXT | Display name |
| role | TEXT | 'Admin' / 'Dispatcher' / 'Accounts' / 'Driver Manager' |
| xp | INTEGER | Experience points |
| completed_challenges | TEXT | JSON array of challenge IDs |
| current_streak | INTEGER | Consecutive active days |
| last_active | TEXT | ISO date |
| created_at | TEXT | |
| updated_at | TEXT | |

Unique constraint: `(session_id, user_email)`

### `import_templates` — Saved column mappings (reusable)
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Template name |
| entity_type | TEXT | 'clients' / 'drivers' / 'rates' / 'zones' |
| source_system | TEXT | Detected competitor system |
| mappings | TEXT | JSON array of `{csvColumn, dfField}` |
| created_by | TEXT | |
| created_at | TEXT | |

Unique constraint: `(name, entity_type)`

---

## API Reference

All routes are prefixed with `/api`. Backend runs on port 3001.

### Session Management

| Method | Path | Description |
|--------|------|-------------|
| POST | `/setup/session` | Create new setup session. Body: `{ environment?, bearerToken?, apiBaseUrl? }` |
| GET | `/setup/session/:id` | Get session by ID |
| GET | `/setup/sessions` | List all sessions. Query: `?status=active` |
| GET | `/setup/sessions/:id/entities` | List entities created in session. Query: `?entityType=client` |
| GET | `/setup/test-auth` | Test both auth methods, returns `{ bearer: {ok, status}, cookie: {ok, status} }` |
| GET | `/setup/health` | Health check |

### Step Routes (0-5)

| Method | Path | Step | TMS Endpoints Hit |
|--------|------|------|-------------------|
| POST | `/setup/business` | 0 | None (saves to session) |
| POST | `/setup/team` | 1 | `POST /api/user` (per member) |
| POST | `/setup/clients` | 2 | `POST /api/client` (bulk) |
| POST | `/setup/clients/import` | 2 | `POST /api/client` (CSV upload → bulk) |
| POST | `/setup/rates` | 3 | Zone group + zones + rate card + breaks + fuel |
| POST | `/setup/couriers` | 4 | `POST /api/courier` + `POST /api/agent` |
| POST | `/setup/automations` | 5 | `POST /api/automationRules` (per rule) |

### Smart Import

| Method | Path | Description |
|--------|------|-------------|
| POST | `/setup/import/detect` | Upload file, auto-detect competitor + entity type + suggested mappings |
| POST | `/setup/import/preview` | Apply mappings to first 10 rows, return preview + validation |
| POST | `/setup/import/execute` | Run full import with confirmed mappings → bulk create via TMS API |
| POST | `/setup/import/google-sheet` | Import from Google Sheet URL/ID via gog CLI |

### Request/Response Schemas

#### POST /setup/business
```json
{
  "sessionId": "uuid",
  "companyName": "Swift Logistics",
  "geography": ["Dallas-Fort Worth", "Houston"],
  "verticals": ["Medical", "Legal"],
  "currentSystem": "Key Software",
  "deliveriesPerMonth": "2,000-10,000"
}
// Response: { success: true, step: 0 }
```

#### POST /setup/team
```json
{
  "sessionId": "uuid",
  "members": [
    { "name": "Sarah Chen", "email": "sarah@swift.com", "role": "Admin" }
  ]
}
// Response: { success: true, step: 1, created: 2, errors?: [...] }
```

#### POST /setup/clients
```json
{
  "sessionId": "uuid",
  "clients": [
    { "name": "Acme Medical", "contact": "Lisa Park", "phone": "(214) 555-0101", "email": "lisa@acme.med", "billing": "Monthly" }
  ]
}
// Response: { success: true, step: 2, total: 4, created: 4, failed: 0, errors: [] }
```

#### POST /setup/clients/import (multipart/form-data)
```
sessionId: "uuid"
file: <CSV file>
```

#### POST /setup/rates
```json
{
  "sessionId": "uuid",
  "baseRate": 8.50,
  "perKmRate": 1.85,
  "minCharge": 12.00,
  "fuelSurcharge": 8.5,
  "waitTime": 0.50,
  "afterHours": 25,
  "zones": [
    { "name": "Downtown", "ranges": ["$8.50", "$12.00", "$18.00", "$25.00"] }
  ],
  "weightBreaks": [
    { "min": 0, "max": 5, "surcharge": 0 }
  ]
}
// Response: { success: true, step: 3, zones: {...}, rates: {...} }
```

#### POST /setup/couriers
```json
{
  "sessionId": "uuid",
  "couriers": [
    { "name": "James Wilson", "phone": "(214) 555-1001", "vehicle": "Van", "zone": "Downtown" }
  ]
}
// Response: { success: true, step: 4, totalCreated: 4, couriers: [...] }
```

#### POST /setup/automations
```json
{
  "sessionId": "uuid",
  "rules": [
    { "type": "SMS_ON_PICKUP", "enabled": true, "name": "SMS on Pickup" }
  ]
}
// Response: { success: true, step: 5, created: 8, ruleIds: [...] }
```

#### POST /setup/import/detect (multipart/form-data)
```
sessionId: "uuid"
file: <CSV or XLSX file>
```
Response:
```json
{
  "success": true,
  "system": "Key Software",
  "confidence": 85,
  "entityType": "clients",
  "headers": ["Account_Name", "Account_Number", "Phone_Number", ...],
  "rowCount": 127,
  "suggestedMappings": [
    { "csvColumn": "Account_Name", "dfField": "name", "confidence": 95 },
    { "csvColumn": "Account_Number", "dfField": "code", "confidence": 95 }
  ]
}
```

---

## Dual Auth System

The TMS has two API surfaces requiring different authentication:

### Bearer JWT (External API)
- **URL**: `https://api.{tenant}.deliverdifferent.com`
- **Auth**: `Authorization: Bearer <jwt-token>`
- **Token source**: Hub → Account Settings → Generate API Key
- **Endpoints**: Jobs, Rates, Webhooks, Labels, Address Validation
- **Class**: `DfrntBearerClient` in `api-client.ts`
- No login needed — token is pre-generated, stateless

### Cookie (Admin Manager)
- **URL**: `https://adminmanager.{tenant}.deliverdifferent.com`
- **Auth**: `.AspNetCore.Cookies` session cookie
- **Login**: POST form to Hub login page → scrape anti-forgery token → POST credentials
- **Endpoints**: Clients, Couriers, Users, Zones, Rates, Automation Rules, etc.
- **Class**: `DfrntApiClient` in `api-client.ts`
- Self-healing: 401/302 → auto re-login → retry

### Smart Routing (DfrntDualClient)
The `DfrntDualClient` wraps both clients and routes by endpoint path:
- `/api/Jobs*`, `/api/Rates*`, `/api/Webhook*`, `/api/JobLabel*` → Bearer client
- Everything else → Cookie client

---

## Smart Import Engine

Located in `backend/src/services/smart-import.ts` (540 lines).

### Pipeline
```
File Upload (CSV/XLSX)
    ↓ parseImportFile()
Headers extracted
    ↓ detectCompetitor()
Competitor identified (CXT/Key/Datatrac/Crown/e-Courier/Generic)
    ↓ buildFieldMappings()
CSV columns mapped to DF system fields
    ↓ validateImportData()
Required fields checked, emails/phones validated, flagged rows
    ↓ transformRow() (per row)
NZ/US localization, state normalization, unit conversion, name splitting
    ↓ bulkCreate() via TMS API
Entities created in TMS
```

### Supported Competitor Systems
| System | Country | Signature Headers | Detection Confidence |
|--------|---------|-------------------|---------------------|
| CXT Software | US | AccountName, AccountCode, DriverCode, LicensePlate | High |
| Key Software | US/Global | Account_Name, Account_Number, Driver_Number | High |
| Datatrac | US/Canada | ACCT_ID, CUST_NAME, DRV_ID, DRV_NAME | High |
| Crown | AU/NZ | ClientCode, ClientName, DriverId, VehicleRego | High |
| e-Courier | US | customer_id, customer_name, driver_id | High |
| Generic | Any | Falls back to keyword matching | Low (30%) |

### Field Mapping Strategy (reused from bulkimport app)
1. **Exact match** — CSV header matches known column name in `COLUMN_TO_FIELD` dictionary
2. **Contains match** — CSV header contains or is contained by a DF field name
3. **Fuzzy match** — Levenshtein distance ≤ 35% of string length and ≤ 3 edits
4. **No match** — `confidence: 0`, user must map manually

### NZ/US Field Localization
Adapted from `FieldMappingUtility.cs` in the existing bulkimport codebase:
- NZ: Suburb, Region, PostCode
- US: City, State, ZipCode
- The `isNzTenant` flag controls which labels are used

### Transforms
| Transform | Description | Example |
|-----------|-------------|---------|
| `toBoolean` | "Active"/"Yes"/"1" → true | "Active" → true |
| `splitName` | "John Smith" → firstName + lastName | "Lisa Park" → {firstName: "Lisa", lastName: "Park"} |
| `kmToMiles` | km × 0.621371 | 10 → 6.2137 |
| `kgToLbs` | kg × 2.20462 | 5 → 11.02 |
| State normalization | Full name → 2-letter abbreviation | "Texas" → "TX" |

---

## Frontend State (Zustand Store)

### Key State Shape
```typescript
{
  currentStep: number           // 0-9
  completedSteps: Set<number>
  sessionId: string | null      // Backend session UUID
  apiStatus: Record<number, 'idle' | 'saving' | 'saved' | 'error'>
  apiErrors: Record<number, string>

  // Step 0: Business
  companyName: string
  geography: string
  selectedCities: string[]
  selectedVerticals: string[]
  currentSystem: string
  deliveryVolume: string

  // Step 1: Team
  teamMembers: TeamMember[]     // { name, email, role }

  // Step 2: Clients
  clients: Client[]             // { name, contact, phone, email, billing }

  // Step 3: Rates
  rates: Record<string, string> // { 'Base Rate': '$8.50', ... }
  zonePricing: string[][]       // [['Downtown', '$8.50', ...], ...]
  weightBreaks: string[]

  // Step 4: Couriers
  couriers: Courier[]           // { name, phone, vehicle, zone }

  // Step 5: Automations
  automations: Record<string, boolean>

  // Step 9: Training
  trainingProgress: Record<string, TrainingState>  // keyed by email
}
```

### Key Actions
- `initSession()` — POST to `/setup/session`, stores sessionId
- `saveStep(step)` — Maps frontend state to backend schema, calls API, tracks status
- `completeChallenge(email, challengeId)` — Updates XP and completed challenges

---

## Training Arena (Step 9)

### XP & Levels
| Level | XP Range | Badge |
|-------|----------|-------|
| Rookie | 0-100 | 🥉 |
| Operator | 100-300 | 🥈 |
| Pro | 300-600 | 🥇 |
| Expert | 600-1000 | 💎 |
| Master | 1000+ | 🏆 |

### Challenge Paths
4 role-based paths: **Dispatcher**, **Admin**, **Accounts**, **Driver**

Each path has 6-8 challenges with prerequisites forming a skill tree. Challenges unlock progressively — completing "First Dispatch" unlocks "Speed Demon" and "Shadow Mode".

Master challenge (500 XP) requires completing all other challenges in the path.

### Demo Data
Pre-populated on init:
- Sarah Chen: 350 XP, Pro level, 6 challenges complete
- Mike Torres: 175 XP, Operator level, 3 challenges complete

---

## Available TMS Environments

| Key | Name | Admin Manager URL |
|-----|------|-------------------|
| urgent-staging | Urgent Staging | adminmanager.urgent.staging.deliverdifferent.com |
| medical-staging | Medical Staging | adminmanager.medical.staging.deliverdifferent.com |
| medical-prod | Medical Production | adminmanager.medical.deliverdifferent.com |
| otg-staging | OTG Staging | adminmanager.otgcargo.staging.deliverdifferent.com |
| otg-prod | OTG Production | adminmanager.otgcargo.deliverdifferent.com |
| mpf-staging | MPF Staging | adminmanager.mpf.staging.deliverdifferent.com |
| mpf-prod | MPF Production | adminmanager.mpf.deliverdifferent.com |
| am-staging | AM Staging | adminmanager.am.staging.deliverdifferent.com |
| crossroads-staging | Crossroads Staging | adminmanager.crossroadscourier.staging.deliverdifferent.com |
| dfrnt-staging | DFRNT Staging | adminmanager.dfrnt.staging.deliverdifferent.com |

Each environment has corresponding Hub, Dispatch, and API URLs following the same subdomain pattern.

---

## Build & Deploy

### Frontend
```bash
cd setup-dashboard
npm run build        # TypeScript + Vite build → dist/
npx gh-pages -d dist # Deploy to GitHub Pages
```

### Backend
```bash
cd setup-dashboard/backend
npm run build        # TypeScript → dist/
npm start            # Run production build
npm run dev          # Dev mode with tsx watch
```

### Type Checking
```bash
# Frontend
cd setup-dashboard && npx tsc -b

# Backend
cd setup-dashboard/backend && npx tsc --noEmit
```

---

## What's NOT Built Yet

### Rollback Engine
The `session_entities` table tracks every entity ID created during setup. A `DELETE /setup/session/:id/rollback` endpoint needs to be built that:
1. Reads all entities for the session from `session_entities`
2. Deletes them from TMS in reverse creation order (rates → zones → couriers → clients → users)
3. Updates session status to 'rolled_back'

### Live Validation
As users fill in wizard steps, ping TMS to validate in real-time:
- Does this zip code exist in the zone table?
- Is this client code already taken?
- Is this email already registered?

### Environment Picker (Frontend)
Add a dropdown in the Header component so DF staff can select which tenant environment to onboard. Currently defaults to whatever the backend `.env` specifies.

### Progress Resume
Load a saved session by ID and resume where the user left off. The SQLite data is there — just need a frontend "Resume Session" flow.

### PDF Setup Summary
Generate a "here's everything we configured" PDF at the end of the wizard. Include all entities created, import history, and next steps.

### Training Backend Integration
Connect the frontend training progress to the SQLite `training_progress` table. Auto-complete challenges by detecting real TMS actions (job created = "First Dispatch" complete, etc.).

---

## Related Repos & Resources

| Resource | Location |
|----------|----------|
| DFRNT CSP (CRM) | `Deliver-Different-Testing/DFRNT-CRM` |
| MCP Server (reference) | `Deliver-Different-Testing/dfrnt-mcp-server` |
| Bulkimport (reference) | GitLab `bulkimport` — C# ASP.NET + AngularJS |
| TMS API Spec | `https://api.{tenant}.deliverdifferent.com/docs/v1/docs.json` |
| Migration Mapping | `setup-dashboard/MIGRATION-MAPPING.md` |
| Design System | `workspace/skills/dfrnt-design-system/SKILL.md` |

### Key Patterns Reused from Bulkimport
- **Template mapping** (`TemplateMappingDto.cs`) → `import_templates` table + `FieldMapping` type
- **Field localization** (`FieldMappingUtility.cs`) → `NZ_FIELD_MAP` / `US_FIELD_MAP` in smart-import.ts
- **Validation** (`homeControl.js mapColumns()`) → `validateImportData()` in smart-import.ts
- **Excel parsing** (ExcelDataReader) → `xlsx` npm package in `parseImportFile()`
