# Setup Dashboard

Onboarding app for new DFRNT tenants: an 11-step journey the tenant and DFRNT both see, with progress, what DFRNT is waiting on the tenant for, and a checklist of DFRNT-owned work. Every record is written through the app that owns it (Settings, Routed Operations) as the signed-in person - never through Admin Manager, and never with placeholder data. Design and status: [`docs/REWRITE-DESIGN-2026-10-24.md`](docs/REWRITE-DESIGN-2026-10-24.md).

Tests: `dotnet test SetupDashboard.Tests -p:SkipNpm=true` and `cd SetupDashboard.Api/ClientApp && npm test`.

## Quick Start

### Visual Studio (Recommended)
1. Open `SetupDashboard.sln`
2. Press F5 — MSBuild builds the React frontend into `wwwroot/`, .NET starts, browser opens
3. Browser opens `https://localhost:7200/setup-dashboard/`

### Terminal
```bash
# Backend (builds frontend automatically on first run)
cd SetupDashboard.Api
dotnet run

# For frontend hot reload (separate terminal)
cd SetupDashboard.Api/ClientApp
npm install
npm run dev    # → http://localhost:5173/setup-dashboard/
```

## Stack
- **Frontend**: React 19 + Vite 7 + Tailwind CSS v4 + Zustand
- **Backend**: .NET 8 + Entity Framework Core 8 + SQL Server
- **Auth**: Hub shared cookie (`.AspNet.SharedCookie`) + Data Protection
- **Cache**: Redis (distributed cache for connection strings)
- **Logging**: Serilog
- **Deploy**: AWS EKS via GitLab CI + Helm (prod), env vars via per-tenant `{TENANT}_{ENV}_ENV` GitLab CI file variables; DataProtection keys in AWS SSM

## Environment Variables

Set in `Properties/launchSettings.json` for dev (gitignored — contains local DB/Redis creds). For staging/prod, vars are injected from per-tenant `{TENANT}_STAGING_ENV` / `{TENANT}_PROD_ENV` GitLab CI file variables.

| Variable | Purpose |
|----------|---------|
| `SQLHealthCheckConnection` | Health check DB connection (master-controller-seed) |
| `MasterSQLConnection` | Master controller DB connection (tenant registry) |
| `SQLCredentials` | SQL credentials appended to tenant connection strings |
| `RedisConfig` | Redis connection string (in-memory fallback in dev) |
| `Domain` | Cookie domain for shared auth |
| `PublicPath` | Hub login redirect URL |

## Documentation
- `HANDOVER.md` — Handover guide (start here)
- `IMPLEMENTATION.md` — Detailed technical reference
- `PLANNING.md` — Architecture and roadmap
- `MIGRATION-MAPPING.md` — Competitor TMS column mappings
- `docs/setup-guide.md` — index of the help centre in `docs/help/` (articles + FAQs for the CSP Knowledge Base / Ask Auto-Mate)
- `changes.log` — Detailed change history
