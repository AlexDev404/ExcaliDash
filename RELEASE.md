# ExcaliDash v0.4.19

Release date: 2026-02-17

## Highlights

- New authentication platform across backend and frontend, including local accounts, optional OIDC integration, admin roles, and onboarding controls.
- New password-reset flow and bootstrap setup code for first-admin initialization.
- User identity, impersonation, and per-user isolation improvements in editor/dashboard flows.
- Expanded import/export surface with compatibility support for legacy SQLite backups.

## Upgrading

<details>
<summary>Show upgrade steps</summary>

### Data safety checklist

- Back up backend volume (`dev.db`, secrets) before upgrading.
- Let migrations run on startup (`RUN_MIGRATIONS=true`) for normal deploys.
- Run `docker compose -f docker-compose.prod.yml logs backend --tail=200` after rollout and verify startup/migration status.

### Recommended upgrade (Docker Hub compose)

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Pin images to this release (recommended for reproducible deploys)

Edit `docker-compose.prod.yml` and pin the release tags:

```yaml
services:
  backend:
    image: zimengxiong/excalidash-backend:v0.4.19
  frontend:
    image: zimengxiong/excalidash-frontend:v0.4.19
```

Example:

```bash
docker compose -f docker-compose.prod.yml up -d
```

</details>

## What's new

- Backend auth stack
  - Added dedicated auth modules and routes (`backend/src/auth/*`) for login/register/refresh/me, account actions, admin controls, and OIDC callbacks.
  - Added auth middleware and mode-aware route protection.
  - Added auth mode configuration with `local | hybrid | oidc_enforced`.
  - Added system-level config, bootstrap setup code support, login-rate-limit configuration, and audit logging plumbing.
- Security hardening
  - Added server- and client-side CSRF improvements and stability tests.
  - Added token hardening and refresh-token rotation controls.
  - Added trusted-proxy handling and stricter onboarding/session safety checks.
- Data and collaboration improvements
  - Added import/export routes and services (including legacy migration/import compatibility).
  - Added drawings cache and socket authentication updates.
  - Added preview utilities and bug fixes for image-sync/persistence in collaborative editing.
- Frontend auth + UX
  - Added login/register/profile/admin/setup/password-reset pages and onboarding flow components.
  - Added protected routes, auth context integration, identity sync, pagination/state hooks, and impersonation banner/update UI.
  - Updated dashboard and editor interactions for authenticated multi-user behavior.
- Operations and DX
  - Added deployment/release tooling cleanup (`scripts/*`, compose updates, workflow refinements).
  - Added/updated migration and setup scripts for safer local workflows.
  - Expanded test coverage (backend, frontend, and e2e), including new auth and image/persistence cases.

## Migration / upgrade notes

- Database changes now include auth-related schema migrations and require migration execution as part of upgrade:
  - New users/auth identity models
  - Auth flags/state
  - Bootstrap setup tracking
- New/updated production-relevant environment requirements were added in config and docs:
  - `AUTH_MODE`, `JWT_SECRET`, `TRUST_PROXY`, OIDC variables, bootstrap/retry limits, audit/release switches.
- `JWT_SECRET` now has stricter validation in production (`.env.example` documents this explicitly).
- On first-run / migration to authenticated mode, users may encounter onboarding/setup screens; follow the documented first-admin setup flow.
- Read updated docs and deployment notes before deploying.
