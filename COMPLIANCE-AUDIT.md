# Compliance Audit — nostrmaxi-canonical

- **Score:** 95/100
- **Status:** Compliant
- **Project Path:** /home/owner/strangesignal/projects/nostrmaxi-canonical
- **Audited:** 2026-02-26T11:12:42.638553

## Layer Scores
- Admin Console: 20
- Configuration Layer: 20
- Connector Framework: 20
- Execution Engine: 20
- Configurable Business Logic: 5
- Documentation: 10

## Evidence
### Admin Console
- `frontend/package-lock.json`
- `frontend/tailwind.config.js`
- `frontend/QUICKSTART.md`
- `frontend/tsconfig.node.json`
- `frontend/IMPLEMENTATION.md`
- `frontend/postcss.config.js`
- `frontend/tsconfig.json`
- `frontend/vite.config.ts`
- `frontend/package.json`
- `frontend/src/main.tsx`
### Configuration Layer
- `frontend/src/config/appConfig.ts`
- `src/config/startup-checks.ts`
- `src/config/validation.ts`
- `package dependencies (db/storage)`
### Connector Framework
- `src/payments/providers/provider-registry.ts`
- `src/app.module.ts`
- `src/main.ts`
### Execution Engine
- `jest.config.js`
- `frontend/src/lib/api.ts`
- `src/subscription/subscription.service.ts`
- `src/subscription/subscription.controller.ts`
### Configurable Business Logic
- `package-lock.json`
- `package.json`
- `scripts/capture-wave7.js`
- `integrations/proven-components-map.json`
- `services/proven-components-gateway.js`
- `services/auth/nostr-auth-integration.js`
- `services/identity-service/src/server.js`
- `docs/archive-extracted/tests/commerce.test.ts`
- `bin/nostrmaxi.js`
- `src/app.module.ts`
### Documentation
- `README.md`
- `ARCHITECTURE.md`
- `STATUS.md`

### Hardcoded Signals
- `package-lock.json`
- `docker-compose.yml`
- `.env.example`
- `nest-cli.json`
- `scripts/capture-wave7.js`
- `docs/archive-extracted/tests/commerce.test.ts`
- `bin/nostrmaxi.js`
- `frontend/package-lock.json`
- `frontend/vite.config.ts`
- `frontend/src/App.tsx`

## Gaps & Remediation
- Move hardcoded logic/constants into configurable settings.