# Setup Dashboard — Handover Guide

**Date:** 2026-03-07
**Status:** ✅ Frontend complete, backend fully wired

---

## What It Is

Internal DFRNT tool for onboarding new courier company tenants. 10-step wizard that configures a TMS instance: company profile → team → clients → rates → couriers → automations → integrations → app config → partners → training.

## Current State

### Frontend (React 19 + Vite 7 + Tailwind CSS 4) — ✅ COMPLETE
- 10-step wizard with progress bar, Zustand state management
- Auto-Mate AI chat sidebar with contextual messages per step
- SmartImport component (4-step: Upload → Detect competitor → Map columns → Preview)
- Help panel with step-specific content
- Session resume capability
- Builds clean, deployed to GitHub Pages

### Backend (Express 4 + TypeScript) — ✅ COMPLETE
All 10 steps have route handlers:

| Step | Route File | Service | Wired to TMS? |
|------|-----------|---------|---------------|
| 0 - Business | `business.ts` | — | ✅ Session creation |
| 1 - Team | `team.ts` | — | ✅ User creation via Admin Manager |
| 2 - Clients | `clients.ts` | `client-import.ts` | ✅ Client creation via Admin Manager |
| 3 - Rates | `rates.ts` | `rate-setup.ts` | ✅ Rate cards, breaks, fuel via Admin Manager |
| 4 - Couriers | `couriers.ts` | `courier-setup.ts` | ✅ Courier + agent creation |
| 5 - Automations | `automations.ts` | — | ✅ Automation rules |
| 6 - Integrations | `integrations.ts` | — | 🔗 Hub launch pad (links only) |
| 7 - App Config | `app-config.ts` | — | 🔗 Hub launch pad (links only) |
| 8 - Partners | `partners.ts` | — | 🔗 Hub launch pad (links only) |
| 9 - Training | — | `database.ts` | ✅ SQLite-tracked XP/progress |

### Smart Import Engine — ✅ COMPLETE
- Auto-detects competitor TMS (CXT Software, Key Software, etc.) from CSV headers
- Fuzzy column matching with confidence scores
- Field transforms (date formats, phone normalization, NZ↔US localization)
- Saved mapping templates for reuse
- See `MIGRATION-MAPPING.md` for competitor column mappings

### Backend Services
| Service | Lines | Purpose |
|---------|-------|---------|
| `database.ts` | 390 | SQLite schema, session CRUD, entity tracking, training progress |
| `smart-import.ts` | 540 | Competitor detection, column matching, transforms |
| `api-client.ts` | 497 | Dual auth: Bearer JWT (external API) + Cookie (Admin Manager) |
| `setup-orchestrator.ts` | 110 | Session management, step orchestration |
| `client-import.ts` | 111 | CSV parsing, bulk client creation |
| `rate-setup.ts` | 118 | Rate card + break groups + fuel surcharge |
| `courier-setup.ts` | 95 | Courier + agent creation |
| `zone-setup.ts` | 86 | Zone group + zone creation |
| `rollback.ts` | — | Entity rollback by session |

## Known Issues / Tech Debt

1. **Steps 6-8 are link stubs** — Intentional; these are configured in Hub UI directly
2. **SQLite for persistence** — Fine for internal tool, but session data isn't backed up
3. **Credentials in .env** — Backend needs real DFRNT credentials per environment
4. **10 environments supported** — Each has different API base URLs (see `api-client.ts`)
5. **Training arena (Step 9)** — Gamified but challenges are predefined, not dynamically generated

## Integration Points

| System | Auth Method | What It Does |
|--------|------------|--------------|
| **Admin Manager** | Cookie (username/password login) | Client, courier, user, zone, rate CRUD |
| **External API** | Bearer JWT | Jobs, rates, webhooks, labels |
| **Hub** | Links only (Steps 6-8) | Integrations, app config, partner network |

## API Architecture Decision: DF API vs In-Project

**Where should new API endpoints live?**

| Build in **DF External API** | Build in **this project** |
|------|------|
| Writing to core TMS tables (clients, locations, contacts, speeds, fleet) | Setup wizard orchestration (session state, progress, step validation) |
| Endpoints other apps might reuse | Import/transform logic (CSV parsing, competitor detection, column mapping) |
| Shared business logic (rate codes, zone lookups, address validation) | Onboarding-only features (training XP, PDF summary, rollback) |

**Rule of thumb:** The setup dashboard is a **thin orchestration layer** that calls the DF API for all data writes. If a bulk endpoint doesn't exist yet (e.g. bulk client import, bulk contact create), add it to the DF API — don't rebuild it here. Import engine, wizard state, and training logic stays local.

Steps 0–5 write data → should go through **DF API**. Steps 6–8 are Hub links. Step 9 is local SQLite.

## What a Developer Needs to Know

1. **Read `IMPLEMENTATION.md`** (638 lines) — complete architecture, schema, and API reference
2. **Two processes needed**: `npm run dev` (frontend :5173) + `cd backend && npm run dev` (backend :3001)
3. **Backend needs `.env`** — copy `.env.example`, fill in real DFRNT credentials
4. **Dual auth is the tricky part** — `api-client.ts` handles both Bearer and Cookie auth; Admin Manager uses session cookies
5. **Smart Import is the star feature** — competitor CSV detection + auto-mapping
6. **`MIGRATION-MAPPING.md`** has detailed column mappings for CXT, Key Software, etc.
