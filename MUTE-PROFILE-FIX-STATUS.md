# MUTE PROFILE FIX STATUS

**Timestamp:** 2026-02-27 10:11 EST  
**Project:** `/home/owner/strangesignal/projects/nostrmaxi-canonical`  
**Operator:** `neo@10.1.10.143`

## Outcome

✅ Mute system moved to **profile settings** (X/Twitter-style central management)  
✅ NIP-51 kind `10000` mute sync flow repaired and made consistent  
✅ Mute filtering now applies universally across feed loading paths (Following, WoT, Firehose/Global, Custom, Bookmarks)  
✅ Per-feed mute controls removed from timeline UI and centralized in Settings  
✅ Muted content filtered before rendering  
✅ Local + operator build/tests pass and operator runtime restarted/verified

---

## What was changed

### 1) Centralized profile-level mute settings (X/Twitter pattern)

- Added shared hook: `frontend/src/hooks/useMuteSettings.ts`
  - Loads/saves profile mute settings from local storage namespace by pubkey
  - Provides explicit `syncNow()` behavior and sync state (`idle/syncing/ok/error`)
- Settings page now owns mute management:
  - `frontend/src/pages/SettingsPage.tsx`
  - Header adjusted to profile safety context
  - Muted words presented as a settings tab pattern

### 2) NIP-51 kind 10000 sync fixes

- Updated mute list tag encoding/decoding in `frontend/src/lib/muteWords.ts`
  - Replaced fragile multi-tag-per-rule serialization with compact, single `word` tag tuple per rule
  - Fixed parser bug where `rid` lookup reused the wrong rule id across entries
  - Added robust parsing fallback path for legacy shape
- Existing publish/sync path remains kind `10000` with privacy mode support

### 3) Universal feed application

- Added mute filtering in feed loading library (`frontend/src/lib/social.ts`):
  - New helper `applyMuteFilterForFeed(...)`
  - Integrated into:
    - `loadFeedWithDiagnostics(...)`
    - `loadBookmarkFeed(...)`
    - `loadFeedForCustomDefinition(...)`
- `frontend/src/pages/FeedPage.tsx` now passes profile mute settings into feed loaders so filtering is applied consistently across modes

### 4) Removed per-feed mute controls from timeline UI

- Removed embedded mute settings panel from feed page
- Removed per-post “Mute phrase…” quick action
- Removed reveal/hide muted toggle on feed page
- Replaced with centralized pointer: “Manage muted words” link to `/settings`

### 5) Sync status UX indicator

- `frontend/src/components/MuteWordsSettings.tsx` now accepts and displays sync status badge:
  - Idle / Syncing / Up to date / Failed

---

## Files changed

- `frontend/src/hooks/useMuteSettings.ts` (new)
- `frontend/src/lib/muteWords.ts`
- `frontend/src/lib/social.ts`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/pages/FeedPage.tsx`
- `frontend/src/components/MuteWordsSettings.tsx`

---

## Verification

### Local (canonical)
- `npm test -- --runInBand` ✅ (43/43 suites, 185/185 tests)
- `npm run build:all` ✅ (backend + frontend)

### Operator (`neo@10.1.10.143`, `/home/neo/nostrmaxi-production`)
- Synced code via `rsync` ✅
- `npm run build` ✅
- `cd frontend && npm install && npm run build` ✅
- `npm test -- --runInBand` ✅ (43/43 suites, 185/185 tests)
- Restarted runtime:
  - `docker restart nostrmaxi-production-backend-1` ✅
  - `systemctl restart nostrmaxi-frontend.service` ✅
- Health checks:
  - `curl http://localhost:8086/health` ✅ healthy
  - frontend reachable on `http://localhost:3402` ✅

---

## Notes

- Initial operator frontend build failed due missing installed frontend deps (`react-markdown`, `rehype-sanitize`, `remark-gfm`) in that environment; resolved by running `npm install` in `/home/neo/nostrmaxi-production/frontend` before build.
- Mute handling is now centralized and profile-driven, with kind `10000` sync pipeline in place and feed-wide enforcement.
