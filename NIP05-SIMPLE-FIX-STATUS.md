# NIP-05 Simple Header/Menu Fix Status

Date: 2026-02-26
Project: `/home/owner/strangesignal/projects/nostrmaxi-canonical`

## What was fixed
Implemented a **simple header/menu identity fix** in `frontend/src/App.tsx` using the same profile metadata flow used by profile surfaces:

- Reads current user profile via `fetchProfileCached(user.pubkey)`
- Uses `isValidNip05(profile?.nip05)` validation
- Displays `profile.nip05` when valid
- Falls back to truncated `npub` when no valid NIP-05 exists
- Shows identity explicitly inside the top-right dropdown menu as well
- Uses existing identity refresh event (`nostrmaxi:identity-refresh`) and profile cache invalidation

## Design choice (kept simple)
- Removed extra resolver/source badge logic from the top-right menu path.
- Kept data flow aligned to profile metadata (kind-0 profile via profile cache), per request.
- No additional hydration complexity added.

## Files changed
- `frontend/src/App.tsx`
- `NIP05-SIMPLE-FIX-STATUS.md` (this report)

## Verification run
From repo root:
- `npm test -- --runInBand` ✅ (25 suites, 114 tests passed)
- `npm run build` ✅
- `npm run build:frontend` ✅

## Operator deploy
Target host: `neo@10.1.10.143`

Actions performed:
1. Synced updated file:
   - local `frontend/src/App.tsx` → operator `/home/neo/strangesignal/projects/nostrmaxi-canonical/frontend/src/App.tsx`
2. Built frontend on operator:
   - `cd /home/neo/strangesignal/projects/nostrmaxi-canonical && npm run build:frontend` ✅

## Screenshot proof
- `/home/owner/strangesignal/projects/nostrmaxi-canonical/ui-evidence/nip05-simple-fix-operator-3401.png`

Note: this capture confirms live page render from operator route. Authenticated menu-open proof depends on an authenticated browser session at capture time.