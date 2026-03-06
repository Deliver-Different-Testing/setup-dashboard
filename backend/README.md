# Setup Dashboard Backend

Express API server that bridges the React setup wizard to the DFRNT TMS API. Uses the same cookie-based auth and session self-healing patterns as the [dfrnt-mcp-server](https://github.com/Deliver-Different-Testing/dfrnt-mcp-server).

## Quick Start

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

Server starts on `http://localhost:3001`.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DFRNT_ENVIRONMENT` | TMS environment key | `medical-staging` |
| `DFRNT_USERNAME` | Hub login email | (required) |
| `DFRNT_PASSWORD` | Hub login password | (required) |
| `PORT` | Server port | `3001` |

## API Endpoints

### Session Management
- `POST /api/setup/session` — Create new setup session `{ environment?: string }`
- `GET /api/setup/session/:id` — Get session progress

### Health
- `GET /api/health` — Environment status and session check

### Setup Steps
| Step | Endpoint | Description |
|------|----------|-------------|
| 0 | `POST /api/setup/business` | Company profile (local storage only) |
| 1 | `POST /api/setup/team` | Create team members → `/api/user` |
| 2 | `POST /api/setup/clients` | Create clients → `/api/client` |
| 2 | `POST /api/setup/clients/import` | CSV import (multipart) → bulk `/api/client` |
| 3 | `POST /api/setup/rates` | Zones + rates + breaks + fuel |
| 4 | `POST /api/setup/couriers` | Couriers + agents → `/api/courier`, `/api/agent` |
| 5 | `POST /api/setup/automations` | Automation rules → `/api/automationRules` |
| 6 | `POST /api/setup/integrations` | Stub — coming soon |
| 7 | `POST /api/setup/app-config` | Stub — coming soon |
| 8 | `POST /api/setup/partners` | Stub — coming soon |

All step endpoints require `{ sessionId: string, ...data }` in the request body.

## Architecture

```
src/
├── index.ts           # Express server + singleton API client
├── api-client.ts      # Cookie-based TMS auth (adapted from MCP server)
├── types/api.ts       # Environment configs + shared types
├── middleware/         # Error handler
├── routes/            # One file per setup step
└── services/          # Orchestration logic (zones, rates, CSV import, couriers)
```

## TMS API Patterns

This backend uses the exact same API endpoints and field names as the MCP server tools:
- Zone management: `/api/zoneName`, `/api/zoneZip`, `/api/zoneGroup`
- Rate management: `/api/rateCard`, `/api/breakGroup`, `/api/break`, `/api/zoneRate`
- Client management: `/api/client`
- Courier management: `/api/courier`, `/api/agent`
- Fuel: `/API/fuel` (note: uppercase API)
- Automation: `/api/automationRules`

Session self-healing: 401/302 responses trigger automatic re-login and request retry.
