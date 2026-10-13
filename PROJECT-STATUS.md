# Setup Dashboard
**Last Updated:** 2026-10-14

## Where the code lives
- **Source of truth:** `gitlab.com/deliver-different/setup-dashboard` (`master`, `develop`). This GitHub repo is a mirror.
- 2026-10-14: GitHub `main` merged from GitLab `master` (unrelated histories). The pre-April GitHub tree
  (`backend/`, `src/`, root Vite files) was the March 2026 prototype and has been removed; the product is
  `SetupDashboard.Api/` with the React app in `SetupDashboard.Api/ClientApp/`.
- `gh-pages` still serves the March prototype at deliver-different-testing.github.io/setup-dashboard — a click-through only.

## Status
- Deployed by GitLab auto-deploy to EKS. Live on **urgent-staging**:
  https://setupdashboard.urgent.staging.deliverdifferent.com/setup-dashboard/ (Hub shared-cookie login).
  Helm values exist for all 8 tenants × staging/prod; no other host resolves yet, no prod deploy.
- Reads the tenant DB via EF Core (`DespatchContext`, master-controller registry + Redis); real validation against tenant tables.
- Writes via Admin Manager API (`ProvisioningService`) using the signed-in staff member's forwarded Hub cookie;
  per-step push on save plus `POST /api/setup/session/{id}/go-live` (zones → rates → clients → couriers → users → automations).
- Sessions in Redis (24 h).

## Open
- No Hub tile / entry point.
- Rates provisioning = rate card + fuel surcharge only (no zone rates, break groups, zone zips).
- Smart Import `execute` saves to session only (pushed when the step is saved).
- Auto-Mate help is scripted text (`ClientApp/src/data/chatMessages.ts`); target is CSP Knowledge Base / Ask Auto-Mate.
- Writes depend on Admin Manager (being retired) and on a user's login — see `docs/SERVICE-AUTH-FOR-PROVISIONING-2026-10-14.md`.
- No recorded end-to-end go-live test on a real tenant.

## Key Decisions
- Separate repo, NOT part of CSP
- No "30-minute setup guarantee"
- Migration approach: tenant exports own data from competitor TMS; DF never accesses competitor systems
- Steps 6-8 are Hub launch pads
- Auto-Mate IS the help system
