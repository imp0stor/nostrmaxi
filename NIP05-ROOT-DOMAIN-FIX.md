# NIP-05 Root Domain Fix Report

## Task
Fix NIP-05 validation so `domain.tld` is accepted (root-domain form, equivalent to `_@domain.tld`) in addition to `user@domain.tld`.

## What I changed

### 1) Updated validator
**File:** `frontend/src/lib/profileCache.ts`

- Replaced strict `user@domain.tld`-only regex with logic that accepts:
  - `user@domain.tld`
  - `domain.tld` (root-domain form)
- Added domain validation guardrails:
  - must contain at least one dot
  - no spaces
  - valid DNS label structure (no empty labels / `..`, proper label characters)

### 2) Added tests
**File:** `frontend/tests/profileCache.test.ts`

Added unit tests for:
- valid `user@domain.tld`
- valid root-domain (`imp0stor.com`)
- invalid no-dot domains (`localhost`, `alice@localhost`)
- invalid values with spaces
- display behavior: `profileDisplayName(..., { nip05: 'imp0stor.com' })` returns `imp0stor.com`

### 3) Jest config update
**File:** `jest.config.js`

- Added frontend test root:
  - `roots: ['<rootDir>/src', '<rootDir>/frontend/tests']`

---

## Local verification (owner host)

### Unit test (targeted)
```bash
npm test -- --runInBand frontend/tests/profileCache.test.ts
```
Result: **PASS (5/5 tests)**

### Full test suite
```bash
npm test
```
Result: **PASS (27 suites, 122 tests)**

### Builds
```bash
npm run build
npm run build:frontend
```
Result: **PASS**

---

## Deployment to operator

**Operator:** `neo@10.1.10.143`
**Project:** `/home/neo/strangesignal/projects/nostrmaxi-canonical`

### Deployed files
- `frontend/src/lib/profileCache.ts`
- `frontend/tests/profileCache.test.ts`
- `jest.config.js`

### Remote verification
Executed on operator:
```bash
npm test -- --runInBand frontend/tests/profileCache.test.ts
npm run build:frontend
```
Result: **PASS**
- targeted tests passed (including root-domain display assertion)
- frontend rebuilt successfully (`frontend/dist` updated)

---

## User-impact confirmation

The deployed validator now accepts root-domain NIP-05 values like:
- `imp0stor.com`

And display logic now treats it as valid, so it is preserved/rendered rather than dropped.

✅ `imp0stor.com` is now valid under NIP-05 handling and will display correctly.
