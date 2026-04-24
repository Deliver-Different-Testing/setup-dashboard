# Setup Dashboard — Planning & Architecture

## What Is This?

A **Deliver Different internal tool** for onboarding new tenants onto the DFRNT TMS platform. Not a tenant-facing self-service tool — DF staff use this alongside the tenant to configure their new instance.

**Repo**: `urgent-couriers/setup-dashboard` (GitLab — to be created)
**Stack**: React 19 + Vite 7 + Tailwind v4 (frontend) / .NET 10 + EF Core 10 + SQL Server (backend) — single deployable, frontend served from .NET `wwwroot/`
**Deploy**: AWS EKS via GitLab CI + Helm (Auto DevOps), per-tenant Helm values
**Solution**: `SetupDashboard.sln` — open in Visual Studio, F5 to debug both

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Setup Dashboard                       │
│                                                         │
│  React Frontend (served from .NET wwwroot/)             │
│  ├── 10-step wizard with Zustand state                  │
│  ├── Auto-Mate chat sidebar (per-step contextual)       │
│  ├── Progress bar (field-level completion tracking)     │
│  └── CSV import with column mapping UI                  │
│                                                         │
│  .NET 8 Backend (SetupDashboard.Api/)                   │
│  ├── EF Core + SQL Server (multi-tenant)                │
│  ├── Hub cookie auth + Redis connection caching         │
│  ├── TMS API SDK (15 service classes, 183 methods)      │
│  ├── Smart Uploader (CSV/Excel fuzzy import)            │
│  └── Session tracking (in-memory shopping cart)         │
│                                                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │  REST calls via api-client
                   │  (cookie auth from MCP server pattern)
                   ▼
┌─────────────────────────────────────────────────────────┐
│           DFRNT TMS (per-tenant instance)                │
│                                                         │
│  Admin Manager API (adminmanager.*.deliverdifferent.com) │
│  ├── ~147 endpoints (zones, clients, rates, agents...)  │
│  └── Cookie-based auth (SharedCookie + hub_session)     │
│                                                         │
│  External API (api.*.deliverdifferent.com)               │
│  ├── 20 endpoints (jobs, rates, webhooks, labels)       │
│  └── JWT Bearer token auth (from Hub Account Settings)  │
│                                                         │
│  Bulk Importer (bulkimport.*.deliverdifferent.com)       │
│  ├── Template-based CSV column mapping                  │
│  ├── Excel + Google Drive import                        │
│  ├── NZ/US field awareness (Suburb/PostCode vs City/Zip)│
│  ├── Geocoding + zone rate lookup                       │
│  └── Stored procedure job creation                      │
└─────────────────────────────────────────────────────────┘
```

---

## Current State

### Frontend ✅ Built
- 10 step components (`Step0Business` → `Step9Training`)
- Shared components: `ChatSidebar`, `Header`, `ProgressBar`, `Toggle`, `Pill`
- Zustand store with all form state + completion tracking
- All toggles, pills, CSV upload, drag zones manage real state
- Built into `wwwroot/setup-dashboard/` by the .csproj `NpmBuild` MSBuild target and served by the .NET app

### Backend ✅ Built (.NET 8)
- .NET 8 Web API with controllers (SetupDashboard.Api/)
- Entity Framework Core 8 with multi-tenant SetupDashboardDbContext (~20 entities)
- Hub cookie-based authentication (shared `.AspNet.SharedCookie`)
- Redis distributed cache for connection string management
- TMS API SDK: 15 C# service classes (183 methods) ported from MCP server
- Smart Uploader: CSV/Excel parse + fuzzy column matching (FuzzySharp)
- Serilog structured logging
- Health checks at `/healthz` and `/health/live`
- Visual Studio solution (SetupDashboard.sln) with pre-built frontend for F5 debugging
- Two launch profiles: IIS Express (local hub) + Project (staging hub)
- Environment variables in launchSettings.json (matches AdminManager/DespatchWeb pattern)
- AWS SSM Data Protection for production deployment

### Documentation ✅
- `MIGRATION-MAPPING.md` — competitor CSV column mappings for CXT, Key Software, Datatrac, Crown, e-Courier
- `docs/setup-guide.md` — end-user guide for DF staff
- `changes.log` — detailed change history
- This file (`PLANNING.md`)

---

## The 9 Setup Steps

| # | Step | Frontend | Backend | TMS API Calls |
|---|------|----------|---------|---------------|
| 0 | 🏢 Your Business | ✅ Company name, geography, verticals, current system, volume | ✅ Stores in session | None (config only) |
| 1 | 👥 Your Team | ✅ Add members with roles, invite buttons | ✅ Route built | `create_user_setup` |
| 2 | 📋 Your Clients | ✅ CSV upload + manual add + table | ✅ CSV parse + bulk create | `create_client` (bulk) |
| 3 | 💰 Your Rates | ✅ Rate cards, zone pricing, weight breaks, accounting connect | ✅ Full orchestration | `create_zone_group` → `create_zone` → `bulk_create_zips` → `create_rate_card` → `create_break_group` → `bulk_create_breaks` → `bulk_create_zone_rates` → `create_fuel` |
| 4 | 🚗 Your Couriers | ✅ Driver cards + QR self-registration | ✅ Route built | `create_courier` → `create_agent` → `create_agent_vehicle` |
| 5 | ⚡ Your Automations | ✅ Toggle switches for 8 automation types | ✅ Route built | `create_automation_rule` → `toggle_automation_rule` |
| 6 | 🔌 AI Integration Builder | ✅ Natural language integration prompt | ⬜ Stub | Future: AI-generated integrations |
| 7 | 📱 AI App Configurator | ✅ Driver workflow steps, feature toggles, vertical profiles | ⬜ Stub | Future: App Configurator API |
| 8 | 🤝 Agents & Partners | ✅ Overflow toggle, network map, Go Live button | ⬜ Stub | Future: Agent network API |

---

## Auth Model

### DF Admin Access (per tenant)
1. New tenant instance provisioned
2. DF admin user auto-created in tenant's Hub
3. DF admin logs into Hub → Account/Settings → generates API key (JWT)
4. API key stored in master-controller (per-tenant registry)

### Two Auth Paths
| Endpoint | Auth Method | Endpoints |
|----------|-------------|-----------|
| `adminmanager.*` | Cookie (SharedCookie + hub_session) | ~147 admin endpoints (zones, clients, agents, rates, services, automations) |
| `api.*` | JWT Bearer token | 20 external endpoints (jobs, rates, webhooks, labels) |

### Current Implementation
Backend uses the same cookie-based auth as AdminManager/RunBuilder/ClientManager:
- Shared cookie (`.AspNet.SharedCookie`) from Hub login
- Data Protection keys shared across all DFRNT apps
- `LoginController` validates cookie claims + caches connection string in Redis
- Direct EF Core database access via `DynamicDespatchDbContextFactory`
- JWT Bearer support planned for external API access once provisioning is automated.

---

## Competitor Migration

### Supported Systems
| System | Status | Notes |
|--------|--------|-------|
| **CXT Software** | 📋 Mapped | US dominant, 20+ years. Building new platform (2yr est.) — current product in maintenance mode |
| **e-Courier** | 📋 Mapped | US, 25+ years. Same parent as CXT — also in maintenance mode during rebuild |
| **Key Software** | 📋 Mapped | 300+ carriers, Xcelerator/MobileTek |
| **Datatrac** | 📋 Mapped | 40+ years, US/Canada, cloud-based |
| **Crown** | 📋 Mapped | AU/NZ market, relevant for DF home market |

### Migration Flow
```
Tenant exports CSV from old system (THEY do this, we don't touch competitors)
    │
    ├── Upload to Setup Dashboard Step 2
    │
    ├── Auto-detect source system from CSV headers
    │
    ├── Pre-populate column mapping from competitor profile
    │      (TemplateMappingDto: UrgentField → ImportField)
    │
    ├── User reviews/corrects mapping
    │
    ├── Transform values (status codes, units, name splitting)
    │      NZ: km→miles, kg→lbs, PostCode→ZipCode
    │
    └── Bulk create entities via TMS API
```

### Existing Bulk Importer (gitlab: bulkimport)
The DFRNT platform already has a battle-tested bulk importer with:
- **Template-based column mapping** — save `UrgentField → ImportField` mappings as reusable templates
- **NZ/US field awareness** — Suburb/PostCode vs City/State/ZipCode (via `FieldMappingUtility`)
- **Excel + CSV + Google Drive** parsing (ExcelDataReader)
- **Geocoding** — auto-geocode addresses via HERE Maps
- **Zone rate lookup** — checks zone rates during import
- **Stored procedure job creation** — `DD_stpJob_InsertExcelerator` (US), `INT_stpJob_BulkInsert` (NZ)
- **Auto job numbering** — generates job numbers if "AUTOGENERATE"

The setup dashboard should **wrap/reference the bulk importer's patterns**, not reinvent them. Competitor-specific preset templates are pre-built `TemplateMappingDto` sets that auto-populate the column mapping.

### Legal Safeguards
- Tenant exports their own data — we never access competitor systems
- Terms of service: "You warrant you have authority to export this data"
- Audit trail: who uploaded, when, from what source
- We never store competitor credentials, ever
- Branded as "data portability tool" not "competitor scraper"

---

## MCP Server Integration

**Repo**: `Deliver-Different-Testing/dfrnt-mcp-server`
**Tools**: ~147 MCP tools covering full tenant onboarding
**Auth**: Cookie-based (auto-login with session self-healing)

The backend's `AdminManagerClient.cs` is adapted from the MCP server. Same:
- Cookie-based auth with auto-login (4-step Hub login flow)
- 401/302 interceptor → auto re-login → retry
- Bulk operations with batching + mid-batch session refresh
- 5-minute cooldown between login attempts
- Environment switching (9 configured environments)

### Key API Quirks (from MCP server ARCHITECTURE.md)
- `GET /api/zoneZip` returns `id: 0` — use `POST /api/zoneZip/search` for real IDs
- Zone rate API ignores `?zoneNameId=X` filter — client-side filter
- `PUT /api/zoneName/{id}` returns 405 — UI-only
- Some endpoints use `/API/` (capital), others `/api/`
- Speed create requires `groupingId` — defaults to 1

---

## What's Next

### Phase 1: Wire Frontend → Backend (Priority: ECA Dallas demo)
- [ ] Connect React frontend to .NET backend API calls
- [ ] Implement CSV upload flow in Step 2 with column auto-mapping
- [ ] Add "Select your old system" dropdown with competitor presets
- [ ] Test end-to-end against `dfrnt-staging` environment

### Phase 2: Auth Upgrade
- [ ] Add JWT Bearer token support to api-client (alongside cookie auth)
- [ ] Automate DF admin user + API key provisioning per tenant
- [ ] Store API keys in master-controller registry

### Phase 3: AI Features
- [ ] Wire Auto-Mate chat to real AI endpoint (not canned responses)
- [ ] AI Integration Builder (Step 6) — natural language → integration config
- [ ] AI App Configurator (Step 7) — describe workflow → configure driver app

### Phase 4: Handover Readiness
- [ ] Unit tests for service layer
- [ ] Docker compose for local dev (frontend + backend)
- [ ] CI/CD pipeline for backend deployment
- [ ] Dev documentation for handover

---

## File Structure

```
setup-dashboard/
├── SetupDashboard.sln                # Visual Studio solution (Solution Items + API project)
├── README.md                         # Quick start guide
├── PLANNING.md                       # This file
├── HANDOVER.md                       # Handover documentation
├── IMPLEMENTATION.md                 # Detailed implementation guide
├── MIGRATION-MAPPING.md              # Competitor CSV column mappings
├── changes.log                       # Detailed change history
├── docs/
│   └── setup-guide.md               # End-user guide for DF staff
├── SetupDashboard.Api/               # .NET 8 Web API
│   ├── SetupDashboard.Api.csproj     # MSBuild pre-build target builds frontend
│   ├── Program.cs                    # DI, auth, EF, Redis, health checks
│   ├── appsettings.json              # Environment URLs, Serilog, AWS config
│   ├── appsettings.Development.json  # Dev CORS origins, debug logging
│   ├── appsettings.Production.json   # Prod CORS origins, tighter logging
│   ├── SqlServerHealthCheck.cs
│   ├── wwwroot/setup-dashboard/      # Pre-built React frontend (gitignored)
│   ├── Core/Domain/
│   │   ├── SetupDashboardDbContext.cs # Slim context (~20 entities)
│   │   ├── Entities/                 # Entity POCOs
│   │   ├── DynamicDespatchDbContext.cs
│   │   ├── DynamicDespatchDbContextFactory.cs
│   │   ├── ConnectionStringManager.cs
│   │   └── DesignTimeDespatchContextFactory.cs
│   ├── Controllers/
│   │   ├── LoginController.cs        # Hub cookie auth
│   │   ├── SetupController.cs        # Session CRUD + step saves
│   │   └── ImportController.cs       # Smart import flow
│   ├── Models/
│   │   ├── TmsApi/                   # 14 DTO files
│   │   ├── SmartUpload.cs
│   │   ├── Session.cs
│   │   └── Environment.cs
│   ├── Services/
│   │   ├── TmsApi/                   # 16 service files (183 methods)
│   │   ├── AdminManagerClient.cs     # Cookie auth HTTP client
│   │   ├── SmartUploaderService.cs
│   │   └── SessionStore.cs
│   ├── ClientApp/                    # React 19 frontend source
│   │   ├── package.json
│   │   ├── vite.config.ts            # Builds to ../wwwroot/setup-dashboard/
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── store.ts              # Zustand store
│   │       ├── lib/api.ts            # All API calls
│   │       └── components/steps/     # Step0-9 components
│   └── Properties/launchSettings.json # Two profiles + env vars (matches AdminManager)
├── .gitlab-ci.yml                    # GitLab CI include of ci-templates
├── Dockerfile                        # Multi-stage SDK 10.0 + Node 20 → ASP.NET 10.0
├── .dockerignore                     # Excludes bin/obj/node_modules/launchSettings/etc.
├── nuget.config                      # nuget.org only (no Telerik feed)
└── .gitlab/                          # Helm values for Auto DevOps deploy
    ├── auto-deploy-values.yaml       # Default (DFRNT staging)
    └── {tenant}-{env}-auto-deploy-values.yaml  # Per-tenant overrides
```

---

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Separate repo from CSP | ✅ | This is a DF tool, not a tenant tool |
| React + Vite frontend | ✅ | Lightweight wizard, fast iteration, served as static assets from the .NET app's wwwroot |
| .NET 8 backend (was Express) | ✅ | Consistent with all DFRNT apps, EF Core for DB access, shared hub auth |
| Cookie auth first, JWT later | ✅ | MCP server pattern works now, JWT is the upgrade path |
| Competitor mapping via CSV | ✅ | Legal safety — tenant exports their own data, we never touch competitors |
| Wrap bulk importer patterns | ✅ | Don't reinvent the template mapping system — reuse `UrgentField → ImportField` model |
| Removed "30-min guarantee" | ✅ | Patronizing to operators. Their businesses are complex. |
| Auto-Mate chat = canned then AI | ✅ | Canned for ECA demo, wire to real AI endpoint later |
