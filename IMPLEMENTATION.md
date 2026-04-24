# Setup Dashboard — Implementation Guide

> **Last updated:** 12 March 2026
> **Owner:** Kevin (frontend + backend)
> **Status:** VS solution, EF Core + SQL Server multi-tenant, hub auth, smart uploader on every step

---

## Architecture

```
┌─────────────────────────────────┐         ┌────────────────────────────────────┐
│  React / Vite / Tailwind        │  /api   │  .NET 8 Web API (port 5200/7200)   │
│  (port 5173, Vite proxy)        │────────▶│  SetupDashboard.Api                │
│                                 │         │                                    │
│  10-step wizard                 │         │  ┌──────────────────────────────┐  │
│  Zustand state store            │         │  │ EF Core + SQL Server         │  │
│  SmartImport on ALL 10 steps    │         │  │ - DespatchContext (~20 ents) │  │
│  Auto-Mate chat sidebar         │         │  │ - Multi-tenant dynamic ctx   │  │
│  Environment picker             │         │  │ - Redis connection caching   │  │
│  Session resume/rollback        │         │  └──────────────────────────────┘  │
│                                 │         │  ┌──────────────────────────────┐  │
│  src/lib/api.ts = all calls     │         │  │ Hub Cookie Auth              │  │
│                                 │         │  │ - SharedCookie + DataProtect │  │
└─────────────────────────────────┘         │  │ - LoginController validates  │  │
                                            │  │ - Connection string caching  │  │
                                            │  └──────────────────────────────┘  │
                                            │  ┌──────────────────────────────┐  │
                                            │  │ SmartUploaderService         │  │
                                            │  │ - CSV/Excel + fuzzy matching │  │
                                            │  │ - Competitor TMS detection   │  │
                                            │  └──────────────────────────────┘  │
                                            │  ┌──────────────────────────────┐  │
                                            │  │ AdminManagerClient           │  │
                                            │  │ - Cookie auth (from MCP)     │  │
                                            │  │ - Push to Admin Manager API  │  │
                                            │  └──────────────────────────────┘  │
                                            │  ┌──────────────────────────────┐  │
                                            │  │ SessionStore (in-memory)     │  │
                                            │  │ - Wizard shopping cart       │  │
                                            │  └──────────────────────────────┘  │
                                            └────────────────────────────────────┘
                                                         │
                                              ┌──────────┼──────────┐
                                              ▼                     ▼
                                 ┌──────────────────┐  ┌──────────────────────┐
                                 │  SQL Server       │  │  Admin Manager API   │
                                 │  (tenant DB)      │  │  (staging/prod)      │
                                 │  via EF Core      │  │  Cookie-based auth   │
                                 └──────────────────┘  └──────────────────────┘
```

## Key Principle

**Two data paths:** The Setup Dashboard can write data via the Admin Manager API (HTTP, using `AdminManagerClient`) or directly to the tenant database via Entity Framework Core (`DynamicDespatchDbContext`). The in-memory session store is just for wizard state while the user is configuring — think of it as a shopping cart before checkout.

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
│   ├── SmartImport.tsx              # CSV/Excel upload modal (reused on ALL steps)
│   ├── Toggle.tsx                   # Toggle switch
│   ├── ValidationIndicator.tsx      # Field validation icons
│   └── steps/
│       ├── Step0Business.tsx        # Company profile       ← SmartImport (business)
│       ├── Step1Team.tsx            # Team members          ← SmartImport (team)
│       ├── Step2Clients.tsx         # Clients + contacts    ← SmartImport (clients, contacts)
│       ├── Step3Rates.tsx           # Zones + rate cards    ← SmartImport (rates)
│       ├── Step4Couriers.tsx        # Drivers/couriers      ← SmartImport (drivers)
│       ├── Step5Automations.tsx     # Automation rules      ← SmartImport (automations)
│       ├── Step6Integrations.tsx    # Hub launch pad        ← SmartImport (integrations)
│       ├── Step7AppConfig.tsx       # Hub launch pad        ← SmartImport (settings)
│       ├── Step8Partners.tsx        # Hub launch pad        ← SmartImport (agents)
│       └── Step9Training.tsx        # Gamified training     ← SmartImport (team roster)
```

### SmartImport Component

`SmartImport.tsx` is a reusable modal used on **all 10 steps** (Steps 0-9). It:
1. Accepts drag-drop CSV or Excel file
2. Calls `POST /api/setup/import/detect` → gets column mapping with confidence %
3. Shows mapping preview — user can adjust if fuzzy match was wrong
4. Calls `POST /api/setup/import/preview` → shows data with validation warnings
5. Calls `POST /api/setup/import/execute` → saves to session

Props: `entityType` (business/team/clients/contacts/drivers/zones/rates/automations/integrations/settings/agents), `onComplete` callback, `onClose` callback.

### Entity Types by Step

| Step | Entity Type | Import Description |
|------|------------|-------------------|
| 0 Business | `business` | Company profile data |
| 1 Team | `team` | Staff/user roster |
| 2 Clients | `clients`, `contacts` | Client list + contact details |
| 3 Rates | `rates` | Zone rates and pricing |
| 4 Couriers | `drivers` | Driver/courier fleet |
| 5 Automations | `automations` | Automation rule configs |
| 6 Integrations | `integrations` | Integration settings |
| 7 App Config | `settings` | App configuration |
| 8 Partners | `agents` | Agent/partner network |
| 9 Training | `team` | Training roster (reuses team type) |

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
SetupDashboard.Api/
├── SetupDashboard.Api.csproj               # Project file (EF Core, Redis, auth, MSBuild frontend)
├── Program.cs                              # DI, auth, EF, Redis, health checks, Serilog
├── appsettings.json                        # Environment URLs, Serilog, AWS config
├── appsettings.Development.json            # Dev CORS origins, debug logging
├── appsettings.Production.json             # Prod CORS origins, tighter logging
├── SqlServerHealthCheck.cs                 # Health check via SELECT @@version
├── Core/Domain/
│   ├── SetupDashboardDbContext.cs          # Slim DbContext (~20 entities for setup wizard)
│   ├── Entities/                           # Entity models (simple [Table]-annotated POCOs)
│   │   ├── Client.cs                       # TucClient
│   │   ├── ClientContact.cs                # tbl_ClientContact
│   │   ├── Agent.cs                        # TucAgent (couriers)
│   │   ├── Courier.cs                      # TucCourier
│   │   ├── AgentVehicle.cs                 # AgentVehicle
│   │   ├── User.cs                         # tbl_User, tbl_UserGroup, tuc_Staff
│   │   ├── Zone.cs                         # ZoneName, ZoneGroup, ZoneZip
│   │   ├── Rate.cs                         # RateCard, BreakGroup, Break, ExtraCharge
│   │   ├── Service.cs                      # tbl_Service
│   │   ├── AutomationRule.cs               # AutomationRule
│   │   └── Lookups.cs                      # Setting, Suburb, Holiday, FuelSurcharge, VehicleType, CourierType
│   ├── DynamicDespatchDbContext.cs          # Multi-tenant context subclass
│   ├── DynamicDespatchDbContextFactory.cs   # Creates context with tenant connection string
│   ├── ConnectionStringManager.cs           # Redis-backed connection string cache
│   └── DesignTimeDespatchContextFactory.cs  # For dotnet ef commands
├── Controllers/
│   ├── LoginController.cs                  # Hub cookie auth + connection caching
│   ├── SetupController.cs                  # Session CRUD + all step save endpoints
│   └── ImportController.cs                 # Smart import detect/preview/execute + templates
├── Models/
│   ├── TmsApi/                             # 14 DTO files for Admin Manager API
│   ├── Environment.cs                      # DfrntEnvironment config
│   ├── Session.cs                          # SetupSession + all step data models
│   └── SmartUpload.cs                      # Upload DTOs + EntityFieldDefinition per type
├── Services/
│   ├── TmsApi/                             # 16 service files (183 methods) — Admin Manager SDK
│   ├── SessionStore.cs                     # In-memory ConcurrentDictionary<string, SetupSession>
│   ├── AdminManagerClient.cs               # Cookie-based HTTP → Admin Manager API
│   └── SmartUploaderService.cs             # CSV/Excel parse + fuzzy match + validate
├── ClientApp/                              # React 19 frontend (Vite + Tailwind)
│   ├── src/                                # All React/TS code
│   ├── vite.config.ts                      # Build to ../wwwroot/setup-dashboard/, dev proxy /api → .NET
│   └── package.json
└── Properties/launchSettings.json          # Two profiles (IIS Express + Project), env vars for dev
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

## TMS API SDK (`Services/TmsApi/`)

Complete C# port of Mike Moraski's MCP server — **183 methods across 15 service classes** covering the entire Admin Manager API. This is a reusable SDK, not just for the Setup Dashboard.

### File Layout

```
Services/TmsApi/
├── TmsServiceBase.cs           # Base class: HTTP helpers, JSON parsing, array extraction
├── TmsApiServiceProvider.cs    # Factory: creates all services from an AdminManagerClient
├── ZoneService.cs              # 20 methods — zones, zone groups, zone zips
├── RateService.cs              # 32 methods — rate cards, break groups, breaks, zone rates, distance rates
├── AgentService.cs             # 21 methods — agents (couriers), vehicles, cargo facilities
├── ClientService.cs            # 16 methods — clients, couriers, staff
├── ContactService.cs           # 12 methods — contacts, client-contact links, permissions
├── ServiceConfigService.cs     # 11 methods — services, speeds, speed groupings
├── SystemService.cs            # 23 methods — read-only lookups (suburbs, users, settings, etc.)
├── ExtraChargeService.cs       # 12 methods — extra charges (accessorials)
├── AutomationRuleService.cs    # 7 methods — automation rules
├── HolidayService.cs           # 6 methods — holidays
├── FuelService.cs              # 5 methods — fuel surcharge rates
├── JobService.cs               # 10 methods — dispatch jobs (uses dispatch subdomain)
├── LocationService.cs          # 4 methods — locations/suburbs
└── NotificationService.cs      # 4 methods — notification templates

Models/TmsApi/
├── Common.cs                   # ApiListResponse<T>, BulkResult, PagedRequest
├── ZoneModels.cs               # Zone, ZoneGroup, ZoneZip, ZoneZipSearchResult
├── RateModels.cs               # RateCard, BreakGroup, Break, ZoneRate, DistanceRate
├── AgentModels.cs              # Agent, AgentVehicle, CargoFacility, AgentLookup
├── ClientModels.cs             # Client, Courier, Staff
├── ContactModels.cs            # Contact, ClientContactLink
├── ServiceModels.cs            # Service, Speed, SpeedGrouping
├── SystemModels.cs             # SuburbLookup, User, Setting, SpeedLookup
├── ExtraChargeModels.cs        # ExtraCharge
├── AutomationModels.cs         # AutomationRule
├── HolidayModels.cs            # Holiday
├── FuelModels.cs               # FuelRate
├── JobModels.cs                # Job, JobStatus
└── LocationModels.cs           # Location
```

### Usage Pattern

```csharp
// In a controller or service:
var client = _clientFactory.Create("medical-staging");
var tms = new TmsApiServiceProvider(client);

// Create a client
var newClient = await tms.Clients.CreateAsync(new Client { Name = "Acme Corp", Code = "ACME" });

// Add zone zips
await tms.Zones.AddZipToZoneAsync(zoneId, new ZoneZip { ZipCode = "2010", Location = "Newmarket" });

// Set up rate card
var rateCard = await tms.Rates.CreateRateCardAsync(new RateCard { Name = "Standard", ServiceId = 1 });
await tms.Rates.CreateZoneRateAsync(new ZoneRate { RateCardId = rateCard.Id, ZoneId = 1, Rate = 15.50m });

// Bulk operations
await tms.Zones.BulkAddZipsToZoneAsync(zoneId, zipCodes, batchSize: 50, delayMs: 100);
```

### MCP → C# Service Mapping

| MCP Tool File | C# Service | Methods | Key Endpoints |
|--------------|------------|---------|---------------|
| `zones.ts` | `ZoneService` | 20 | `/api/zoneName`, `/api/zoneZip`, `/api/zoneGroup` |
| `rates.ts` | `RateService` | 32 | `/api/rateCard`, `/api/breakGroup`, `/api/break`, `/api/zoneRate` |
| `agents.ts` | `AgentService` | 21 | `/api/agent`, `/api/agentVehicle`, `/api/cargoFacility` |
| `clients.ts` | `ClientService` | 16 | `/api/client`, `/api/courier`, `/api/staff` |
| `contacts.ts` | `ContactService` | 12 | `/API/contact`, `/API/clientContact` |
| `services.ts` | `ServiceConfigService` | 11 | `/api/service`, `/api/speed`, `/api/speedGrouping` |
| `system.ts` | `SystemService` | 23 | `/api/speed`, `/api/suburb`, `/api/user`, `/api/setting` |
| `extra-charges.ts` | `ExtraChargeService` | 12 | `/API/rate` (with rateType filter) |
| `automation-rules.ts` | `AutomationRuleService` | 7 | `/api/automationRules` |
| `holidays.ts` | `HolidayService` | 6 | `/API/holiday` |
| `fuel.ts` | `FuelService` | 5 | `/API/fuel` |
| `jobs.ts` | `JobService` | 10 | `despatch.*/job` |
| `locations.ts` | `LocationService` | 4 | `/api/location` |
| `notifications.ts` | `NotificationService` | 4 | `/api/notification` |
| `bulk.ts` | (in TmsServiceBase) | — | Batching + delay utilities |

### Known API Quirks (Ported from MCP)

| Quirk | Workaround in C# SDK |
|-------|---------------------|
| `GET /api/zoneZip` returns `id: 0` for all records | `SearchZoneZipsAsync()` uses `POST /api/zoneZip/search` instead |
| Zone rate API ignores `?zoneNameId=X` filter | Client-side filtering after fetching all |
| Some endpoints use `/API/` (capital), others `/api/` | Each service method uses the correct casing |
| `PUT /api/zoneName/{id}` returns 405 | Documented — zone names are create-only |
| `GET /api/cargoFacility` returns 405 | Documented — cargo facility list is UI-only |
| Speed create requires hidden `groupingId` | Defaults to 1 (Excelerator) |
| `DELETE /api/zoneZip/{id}` silently fails | Documented as known issue |
| Fuel API uses `start`/`end` not `validStart`/`validEnd` | Correct field names in DTOs |
| Update operations require GET→strip→merge→POST | Built into all `UpdateAsync()` methods |

---

## Code Reuse Map

| Feature | Source | What was reused |
|---------|--------|-----------------|
| Cookie auth | `dfrnt-mcp-server/src/api-client.ts` | Full 4-step login, cookie jar, auto-retry, session file format |
| **All 147 API tools** | `dfrnt-mcp-server/src/tools/*.ts` | **Complete port to 15 C# service classes (183 methods)** |
| Environment config | `dfrnt-mcp-server/src/types/api.ts` | Tenant URLs, subdomain patterns |
| API quirks | `dfrnt-mcp-server/ARCHITECTURE.md` | All documented workarounds ported |
| Bulk operations | `dfrnt-mcp-server/src/api-client.ts` | Batch + delay + mid-bulk refresh pattern |
| Field mapping | `bulkimport/Application/Core/Utilities/FieldMappingUtility.cs` | Column detection pattern, alias approach |
| Address handling | `bulkimport/Application/Core/Utilities/AddressUtility.cs` | NZ vs US field naming |
| Upload flow | `bulkimport/Api/Controllers/BulkController.cs` | Upload → parse → validate → import pattern |

---

## NuGet Packages

| Package | Version | Purpose |
|---------|---------|---------|
| CsvHelper | 31.0.2 | CSV parsing |
| ClosedXML | 0.102.3 | Excel (.xlsx) read/write |
| FuzzySharp | 2.0.2 | Fuzzy string matching for column auto-mapping |
| Microsoft.EntityFrameworkCore | 8.0.10 | Entity Framework Core |
| Microsoft.EntityFrameworkCore.SqlServer | 8.0.10 | SQL Server provider |
| Microsoft.EntityFrameworkCore.Tools | 8.0.10 | EF CLI tools (migrations, scaffolding) |
| Microsoft.Data.SqlClient | 5.2.2 | SQL Server client (health checks) |
| Microsoft.Extensions.Caching.StackExchangeRedis | 8.0.10 | Redis distributed cache |
| Microsoft.Extensions.Diagnostics.HealthChecks | 8.0.10 | Health check framework |
| AspNetCore.HealthChecks.SqlServer | 8.0.2 | SQL Server health check |
| Amazon.AspNetCore.DataProtection.SSM | 3.2.1 | AWS SSM data protection (prod) |
| Serilog.AspNetCore | 8.0.3 | Structured logging |
| Serilog.Settings.Configuration | 8.0.4 | Serilog config from appsettings |
| Serilog.Sinks.Console | 6.0.0 | Console log sink |

---

## What's Not Yet Implemented

| Feature | Priority | Notes |
|---------|----------|-------|
| Admin Manager push from import flow | **High** | TMS SDK is built — wire `ImportController.Execute` to call the appropriate service |
| Database session persistence | Medium | EF Core is wired up — migrate `SessionStore` from in-memory to DespatchContext |
| Direct DB operations | Medium | Use EF Core for bulk reads/lookups instead of API calls where appropriate |
| Google Sheets import | Low | Endpoint stub exists, needs Google API credentials |
| WebSocket import progress | Low | Currently returns final result; large imports could use real-time progress |
| Steps 6-8 API calls | Low | These are Hub launch pads — may never need backend calls |
