# Setup Dashboard — Implementation Guide

> **Last updated:** 11 March 2026
> **Owner:** Kevin (frontend + backend)
> **Status:** Backend compiles, frontend runs, smart uploader on every step

---

## Architecture

```
┌─────────────────────────────────┐         ┌────────────────────────────────────┐
│  React / Vite / Tailwind        │  fetch  │  .NET 8 Web API (port 3001)        │
│  (port 5173)                    │────────▶│                                    │
│                                 │         │  ┌──────────────────────────────┐  │
│  10-step wizard                 │         │  │ SmartUploaderService         │  │
│  Zustand state store            │         │  │ - CSV/Excel parsing          │  │
│  SmartImport on every step      │         │  │ - Fuzzy column matching      │  │
│  Auto-Mate chat sidebar         │         │  │ - Competitor system detect   │  │
│  Environment picker             │         │  │ - Validation + preview       │  │
│  Session resume/rollback        │         │  └──────────────────────────────┘  │
│                                 │         │  ┌──────────────────────────────┐  │
│  src/lib/api.ts = all calls     │         │  │ AdminManagerClient           │  │
│                                 │         │  │ - Cookie auth (from MCP)     │  │
└─────────────────────────────────┘         │  │ - Auto-login + retry         │  │
                                            │  │ - Push to real TMS API       │  │
                                            │  └──────────────────────────────┘  │
                                            │  ┌──────────────────────────────┐  │
                                            │  │ SessionStore (in-memory)     │  │
                                            │  │ - ConcurrentDictionary       │  │
                                            │  │ - Thread-safe                │  │
                                            │  └──────────────────────────────┘  │
                                            └────────────────────────────────────┘
                                                         │
                                                         ▼
                                            ┌────────────────────────────────────┐
                                            │  DFRNT Admin Manager API           │
                                            │  (staging or production)           │
                                            │  Cookie-based auth via hub login   │
                                            └────────────────────────────────────┘
```

## Key Principle

**Data writes → DF API.** The Setup Dashboard does NOT have its own database. All permanent data goes to the Admin Manager API. The in-memory session store is just for wizard state while the user is configuring — think of it as a shopping cart before checkout.

---

## Frontend (React)

### File Layout

```
src/
├── App.tsx                          # Main layout, step navigation
├── main.tsx                         # Entry point
├── store.ts                         # Zustand store (wizard state)
├── lib/
│   └── api.ts                       # ALL backend API calls (single file)
├── hooks/
│   └── useValidation.ts             # Per-step validation logic
├── data/
│   ├── chatMessages.ts              # Auto-Mate conversation scripts
│   └── helpContent.ts               # Step help panel content
├── components/
│   ├── ChatSidebar.tsx              # Auto-Mate floating chat assistant
│   ├── EnvironmentPicker.tsx        # Tenant environment selector
│   ├── Header.tsx                   # Top bar with progress
│   ├── HelpPanel.tsx                # Contextual help
│   ├── PdfSummary.tsx               # End-of-wizard PDF export
│   ├── Pill.tsx                     # Status pill component
│   ├── ProgressBar.tsx              # Step progress indicator
│   ├── ResumeSession.tsx            # Resume previous session dialog
│   ├── SmartImport.tsx              # CSV/Excel upload modal (reused everywhere)
│   ├── Toggle.tsx                   # Toggle switch
│   ├── ValidationIndicator.tsx      # Field validation icons
│   └── steps/
│       ├── Step0Business.tsx        # Company profile
│       ├── Step1Team.tsx            # Team members        ← SmartImport
│       ├── Step2Clients.tsx         # Clients + contacts  ← SmartImport
│       ├── Step3Rates.tsx           # Zones + rate cards   ← SmartImport
│       ├── Step4Couriers.tsx        # Drivers/couriers     ← SmartImport
│       ├── Step5Automations.tsx     # Automation rules
│       ├── Step6Integrations.tsx    # Hub launch pad (links)
│       ├── Step7AppConfig.tsx       # Hub launch pad (links)
│       ├── Step8Partners.tsx        # Hub launch pad (links)
│       └── Step9Training.tsx        # Gamified training
```

### SmartImport Component

`SmartImport.tsx` is a reusable modal used on Steps 1-4. It:
1. Accepts drag-drop CSV or Excel file
2. Calls `POST /api/setup/import/detect` → gets column mapping with confidence %
3. Shows mapping preview — user can adjust if fuzzy match was wrong
4. Calls `POST /api/setup/import/preview` → shows data with validation warnings
5. Calls `POST /api/setup/import/execute` → saves to session

Props: `entityType` (team/clients/contacts/drivers/zones/rates), `sessionId`, `onImport` callback.

### Steps 6-8 (Hub Launch Pads)

These are NOT full config forms — they link out to existing Hub UI pages. The Setup Dashboard just provides context and links. Don't try to build full CRUD here.

### Step 9 (Training)

Gamified training module with:
- Challenge completion tracking
- XP points per team member
- Leaderboard
- Progress persistence via backend

---

## Backend (.NET 8)

### File Layout

```
backend/
├── Program.cs                              # Entry point, DI, CORS, middleware
├── SetupDashboard.Api.csproj               # Project file
├── appsettings.json                        # Environment URLs
├── Models/
│   ├── Environment.cs                      # DfrntEnvironment { Key, Name, HubUrl, AdminUrl, DispatchUrl }
│   ├── Session.cs                          # SetupSession + all step data models
│   └── SmartUpload.cs                      # Upload DTOs + EntityFieldDefinition per type
├── Services/
│   ├── SessionStore.cs                     # In-memory ConcurrentDictionary<string, SetupSession>
│   ├── AdminManagerClient.cs               # Cookie-based HTTP → Admin Manager API
│   └── SmartUploaderService.cs             # CSV/Excel parse + fuzzy match + validate
└── Controllers/
    ├── SetupController.cs                  # Session CRUD + all step save endpoints
    └── ImportController.cs                 # Smart import detect/preview/execute + templates
```

### AdminManagerClient — Auth Pattern

Ported directly from Mike's MCP server (`dfrnt-mcp-server/src/api-client.ts`). The flow:

1. Load cookies from `auth/{env}.json` (Playwright StorageState format)
2. If no session file → auto-login via 4-step flow:
   - GET hub login page → extract `__RequestVerificationToken`
   - POST credentials → capture `.AspNet.SharedCookie`
   - POST `/API/Login/Validate` → get `hub_session` cookie
   - GET dispatch URL → establish dispatch session
3. On 401/302 → auto-retry login (5-min cooldown to prevent storms)

**Shares session files with the MCP server** — if MCP is already authenticated, symlink `auth/` folder.

### SmartUploaderService — Column Matching

The magic — ported from `bulkimport/Application/Core/Utilities/FieldMappingUtility.cs` and enhanced:

- **Exact match** → 100% confidence
- **Alias match** → 95% (e.g., "Phone Number" matches "phone", "Zip Code" matches "zipCode")
- **Fuzzy match** → 60-94% (FuzzySharp Levenshtein distance)
- **Known system detection** → recognizes CSV exports from:
  - Key Software (KS_ prefixed columns)
  - Elite EXTRA
  - Datatrac (DT_ prefixed)
  - Crown (CRW_ prefixed)
  - e-Courier (EC_ prefixed)
  - CXT

When a competitor system is detected, column mappings are pre-configured for that system's export format.

### Entity Field Definitions (SmartUpload.cs)

Each importable entity type defines its fields with:
- `FieldName` — internal name
- `DisplayName` — shown in UI
- `Required` — validation flag
- `Aliases` — list of alternative column header names that match this field

Current entity types:

| Entity | Fields | Used In |
|--------|--------|---------|
| `team` | Name, Email, Role | Step 1 |
| `clients` | Name, Code, Contact, Phone, Email, BillingAddress, City, State, ZipCode | Step 2 |
| `contacts` | ClientName, FirstName, LastName, Email, Phone, Role, IsPrimary | Step 2 |
| `drivers` | Name, Code, FirstName, SurName, Phone, VehicleType, ZoneName | Step 4 |
| `zones` | ZoneName, ZipCode, ZoneNumber, Location | Step 3 |
| `rates` | ZoneName, ServiceType, MinWeight, MaxWeight, Rate | Step 3 |

---

## API Reference

### Session Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/setup/session` | Create new session (body: `{ environment }`) |
| GET | `/api/setup/sessions?status=active` | List sessions |
| GET | `/api/setup/session/{id}/full` | Get full session with all step data |
| DELETE | `/api/setup/session/{id}/rollback` | Delete/rollback session |

### Wizard Step Saves
| Method | Endpoint | Body |
|--------|----------|------|
| POST | `/api/setup/business` | `{ sessionId, companyName, abn, country, ... }` |
| POST | `/api/setup/team` | `{ sessionId, members: [...] }` |
| POST | `/api/setup/clients` | `{ sessionId, clients: [...] }` |
| POST | `/api/setup/rates` | `{ sessionId, zones, rateCards, ... }` |
| POST | `/api/setup/couriers` | `{ sessionId, couriers: [...] }` |
| POST | `/api/setup/automations` | `{ sessionId, rules: [...] }` |

### Smart Import (all steps)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/setup/import/detect` | Upload file → auto-detect columns (multipart: file + sessionId + entityType) |
| POST | `/api/setup/import/preview` | Validate mapped data, return preview |
| POST | `/api/setup/import/execute` | Confirmed import → save to session |
| GET | `/api/setup/import/template/{entityType}` | Download blank CSV template |
| POST | `/api/setup/import/{entityType}/upload` | Step-specific shortcut (detect + preview in one call) |

### Training (Step 9)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/setup/training/progress?sessionId=X` | Get training progress |
| POST | `/api/setup/training/progress` | Save progress |
| POST | `/api/setup/training/complete-challenge` | Complete challenge (earn XP) |
| GET | `/api/setup/training/leaderboard?sessionId=X` | Leaderboard |

### Validation
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/setup/validate/username?username=X` | Check username availability |
| GET | `/api/setup/validate/client-code?code=X` | Check client code uniqueness |
| GET | `/api/setup/validate/courier-code?code=X` | Check courier code uniqueness |

### Config
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/setup/environments` | List available DFRNT environments |

---

## Code Reuse Map

| Feature | Source | What was reused |
|---------|--------|-----------------|
| Cookie auth | `dfrnt-mcp-server/src/api-client.ts` | Full 4-step login, cookie jar, auto-retry, session file format |
| Environment config | `dfrnt-mcp-server/src/types/api.ts` | Tenant URLs, subdomain patterns |
| API endpoints | `dfrnt-mcp-server/src/tools/*.ts` | Client/courier/zone/rate CRUD endpoint paths |
| Field mapping | `bulkimport/Application/Core/Utilities/FieldMappingUtility.cs` | Column detection pattern, alias approach |
| Address handling | `bulkimport/Application/Core/Utilities/AddressUtility.cs` | NZ vs US field naming (Suburb/City, PostCode/ZipCode) |
| Upload flow | `bulkimport/Api/Controllers/BulkController.cs` | Upload → parse → validate → import pattern |
| Validation | `bulkimport/Application/Core/Validators/` | Required field checking, duplicate detection |

---

## NuGet Packages

| Package | Version | Purpose |
|---------|---------|---------|
| CsvHelper | 33.* | CSV parsing |
| ClosedXML | 0.104.* | Excel (.xlsx) read/write |
| FuzzySharp | 2.* | Fuzzy string matching for column auto-mapping |

---

## What's Not Yet Implemented

| Feature | Priority | Notes |
|---------|----------|-------|
| Real Admin Manager push | **High** | `AdminManagerClient` has the auth pattern — needs endpoint wiring per entity type |
| Database session persistence | Medium | Replace `SessionStore` (in-memory) with SQL/Redis |
| Google Sheets import | Low | Endpoint stub exists, needs Google API credentials |
| WebSocket import progress | Low | Currently returns final result; large imports could use real-time progress |
| Steps 6-8 API calls | Low | These are Hub launch pads — may never need backend calls |
