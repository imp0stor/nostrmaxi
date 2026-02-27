# NostrMaxi Rebuild Audit (2026-02-26)

## Current stack audit

### Frontend
- ✅ React + Vite already in use (`frontend/vite.config.ts`, React 18)
- ✅ Zustand already in use for auth state (`frontend/src/hooks/useAuth.ts`)
- ❌ `@strangesignal/ui-primitives` was not wired before this pass

### Backend
- ❌ Primary backend is NestJS monolith (`src/*`)
- ✅ PostgreSQL is in use (Prisma/Postgres)
- ❌ Not aligned with target Express microservice architecture

### Auth
- ⚠️ `@strangesignal/nostr-auth` present in backend deps, but auth flow mostly custom in Nest auth service
- ✅ Existing auth implementation is functional

### Identity service
- ⚠️ Identity flows exist but tied to monolith routes
- ✅ Functional features present, but not isolated as dedicated microservice

## Changes made in this pass

1. **Frontend theme + primitives integration**
   - Added `@strangesignal/ui-primitives` dependency to frontend.
   - Wrapped app with `ThemeProvider` using `defaultTheme="minimal-light"`.
   - Replaced main nav login button with ui-primitives `Button`.

2. **State migration reinforcement (Zustand-first)**
   - Added `frontend/src/stores/identityStore.ts` using Zustand for:
     - identity list load
     - create identity
     - delete identity
     - error/success messaging
   - Updated `Nip05Page.tsx` to consume the Zustand identity store instead of direct local request state.

3. **Microservice foundation (Express + Postgres + nostr-auth)**
   - Added new service scaffold:
     - `services/identity-service/package.json`
     - `services/identity-service/src/server.js`
   - Uses:
     - Express
     - PostgreSQL (`pg`)
     - `@strangesignal/nostr-auth/server` middleware
   - Implements identity endpoints (`/api/v1/identity/*`) + health.

## Remaining work for full target compliance

- Replace NestJS monolith runtime with full Express microservices (auth, identity, subscriptions, payments).
- Route frontend NIP-05 flows to the new identity service endpoint contract.
- Integrate the already-verified `@strangesignal/nostr-auth` package end-to-end as primary auth path.
- Wire service-to-service routing via API gateway/reverse proxy for Operator deployment.
- Run deployment on Operator host + verify production DNS/proxy path.
- Execute complete E2E auth + identity verification in deployed environment.
