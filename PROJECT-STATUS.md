# Setup Dashboard
**Last Updated:** 2026-03-14

## Status
- Standalone React app with 10-step wizard, smart import engine, Auto-Mate assistant
- .NET 8 backend built (no database — all permanent data → Admin Manager API; in-memory SessionStore)
- All 147 MCP server tools ported to C# TMS API SDK (15 services, 183 methods, 14 DTOs)
- Smart Import button on every wizard step (0-9)

## Key Decisions
- Separate repo, NOT part of CSP
- No "30-minute setup guarantee" — operators know their business is complex
- Migration approach: tenant exports own data from competitor TMS; DF never accesses competitor systems (legal safeguard)
- Steps 6-8 are Hub launch pads (link to existing Hub UI, don't rebuild)
- Auto-Mate IS the help system — popup chat overlay, not page navigation
- No own database — in-memory session store for wizard state, permanent data → Admin Manager API

## Architecture Notes
- Frontend: React/Vite/Tailwind + Zustand store
- Backend: .NET 8 Web API (port 3001) with SmartUploaderService + AdminManagerClient
- Smart Import recognizes 6 competitor TMS CSV exports (CXT, Key Software, Datatrac, Crown, e-Courier, Elite EXTRA)
- AI scan-to-fill across all forms
- Cookie auth for Admin Manager endpoints; JWT Bearer for Hub

## Handover Log
| Date | Event |
|------|-------|
| 2026-03-11 | HANDOVER.md pushed (Kevin handover — full wizard spec + smart uploader docs) |
| 2026-03-11 | IMPLEMENTATION.md pushed (architecture, file layout, API reference) |
| 2026-03-14 | PROJECT-STATUS.md added for dev productivity tracking |
