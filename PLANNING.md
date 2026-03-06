# Setup Dashboard — Planning & Architecture

## What Is This?

A **Deliver Different internal tool** for onboarding new tenants onto the DFRNT TMS platform. Not a tenant-facing self-service tool — DF staff use this alongside the tenant to configure their new instance.

**Repo**: `Deliver-Different-Testing/setup-dashboard`
**Live**: https://deliver-different-testing.github.io/setup-dashboard/
**Stack**: React 19 + Vite + Tailwind CSS (frontend) / Express + TypeScript (backend)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Setup Dashboard                       │
│                                                         │
│  React Frontend (GitHub Pages)                          │
│  ├── 9-step wizard with Zustand state                   │
│  ├── Auto-Mate chat sidebar (per-step contextual)       │
│  ├── Progress bar (field-level completion tracking)     │
│  └── CSV import with column mapping UI                  │
│                                                         │
│  Express Backend (backend/)                             │
│  ├── Routes per wizard step (9 route files)             │
│  ├── api-client.ts (adapted from MCP server)            │
│  ├── Service layer (orchestration, zone/rate/client)    │
│  └── Session tracking (entity IDs for rollback)         │
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
- 9 step components (`Step0Business` → `Step8Partners`)
- Shared components: `ChatSidebar`, `Header`, `ProgressBar`, `Toggle`, `Pill`
- Zustand store with all form state + completion tracking
- All toggles, pills, CSV upload, drag zones manage real state
- Deployed to GitHub Pages

### Backend ✅ Scaffolded
- Express server on port 3001
- 9 route files (Steps 0-5 wired to TMS API, Steps 6-8 stubs)
- 5 service files: `setup-orchestrator`, `zone-setup`, `rate-setup`, `client-import`, `courier-setup`
- `api-client.ts` adapted from MCP server (cookie auth, session self-healing, bulk ops)
- All 9 TMS environment configs copied from MCP server
- Zod validation on all request bodies
- CORS configured for dev + production

### Documentation ✅
- `MIGRATION-MAPPING.md` — competitor CSV column mappings for CXT, Key Software, Datatrac, Crown, e-Courier
- `backend/README.md` — how to run the backend
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
Backend uses cookie-based auth (adapted from MCP server). JWT Bearer support planned as primary auth once API key provisioning is automated.

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

The backend's `api-client.ts` is adapted from the MCP server. Same:
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
- [ ] Connect React frontend to Express backend API calls
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
├── PLANNING.md              # This file
├── MIGRATION-MAPPING.md     # Competitor CSV column mappings
├── README.md                # Quick start
├── index.html               # Vite entry
├── package.json             # React 19, Vite, Tailwind, Zustand
├── vite.config.ts           # base: '/setup-dashboard/'
├── src/
│   ├── main.tsx             # Entry point
│   ├── App.tsx              # Router + layout
│   ├── store.ts             # Zustand store (all wizard state)
│   ├── index.css            # Tailwind + custom styles
│   ├── data/
│   │   └── chatMessages.ts  # Per-step Auto-Mate messages
│   └── components/
│       ├── Header.tsx       # Top bar (logo, welcome, progress %)
│       ├── ChatSidebar.tsx  # Auto-Mate chat panel
│       ├── ProgressBar.tsx  # Step progress indicator
│       ├── Toggle.tsx       # Toggle switch component
│       ├── Pill.tsx         # Selectable pill/tag component
│       └── steps/
│           ├── Step0Business.tsx    # Company setup
│           ├── Step1Team.tsx        # Team members
│           ├── Step2Clients.tsx     # Client import
│           ├── Step3Rates.tsx       # Rate cards
│           ├── Step4Couriers.tsx    # Driver setup
│           ├── Step5Automations.tsx # Automation toggles
│           ├── Step6Integrations.tsx # AI Integration Builder
│           ├── Step7AppConfig.tsx   # App Configurator
│           └── Step8Partners.tsx    # Agent network
├── backend/
│   ├── package.json         # Express, axios, tough-cookie, zod, papaparse
│   ├── tsconfig.json
│   ├── .env.example
│   ├── README.md
│   └── src/
│       ├── index.ts         # Express server (port 3001)
│       ├── api-client.ts    # TMS API client (from MCP server)
│       ├── types/
│       │   └── api.ts       # Environment configs (9 envs)
│       ├── middleware/
│       │   └── error-handler.ts
│       ├── routes/
│       │   ├── index.ts     # Route barrel
│       │   ├── health.ts    # GET /api/health
│       │   ├── business.ts  # Step 0
│       │   ├── team.ts      # Step 1
│       │   ├── clients.ts   # Step 2
│       │   ├── rates.ts     # Step 3
│       │   ├── couriers.ts  # Step 4
│       │   ├── automations.ts # Step 5
│       │   ├── integrations.ts # Step 6 (stub)
│       │   ├── app-config.ts   # Step 7 (stub)
│       │   └── partners.ts     # Step 8 (stub)
│       └── services/
│           ├── setup-orchestrator.ts # Session + progress tracking
│           ├── zone-setup.ts         # Zone group → zones → zips
│           ├── rate-setup.ts         # Rate card → breaks → zone rates
│           ├── client-import.ts      # CSV parse + bulk create
│           └── courier-setup.ts      # Courier + agent creation
└── dist/                    # Vite build output (GitHub Pages)
```

---

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Separate repo from CSP | ✅ | This is a DF tool, not a tenant tool |
| React + Vite (not .NET) | ✅ | Lightweight wizard, fast iteration, GitHub Pages deploy |
| Express backend (not .NET) | ✅ | Same language as frontend, reuse MCP server patterns directly |
| Cookie auth first, JWT later | ✅ | MCP server pattern works now, JWT is the upgrade path |
| Competitor mapping via CSV | ✅ | Legal safety — tenant exports their own data, we never touch competitors |
| Wrap bulk importer patterns | ✅ | Don't reinvent the template mapping system — reuse `UrgentField → ImportField` model |
| Removed "30-min guarantee" | ✅ | Patronizing to operators. Their businesses are complex. |
| Auto-Mate chat = canned then AI | ✅ | Canned for ECA demo, wire to real AI endpoint later |
