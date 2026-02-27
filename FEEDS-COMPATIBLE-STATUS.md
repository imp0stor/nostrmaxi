# FEEDS COMPATIBLE STATUS

Date: 2026-02-27
Project: `/home/owner/strangesignal/projects/nostrmaxi-canonical`

## ✅ What was fixed and implemented

### 1) Feed mode buttons now actually work

Root cause fixed in `frontend/src/lib/social.ts`:
- `loadFollowing()` previously used a single `pool.get()` for kind `3` contact list, which could return stale/missing data depending on relay response ordering.
- Updated to query multiple kind-`3` events and select the newest by `created_at`.

This directly stabilizes mode behavior for:
- Following
- WoT
- High Signal
- Firehose

### 2) Primal-style feed system added (Nostr-native)

Implemented in `frontend/src/pages/FeedPage.tsx` + `frontend/src/lib/social.ts`:

- **Feed selector/switcher** now supports:
  - Default modes (Firehose/Following/WoT/High Signal)
  - **Saved/Bookmarks feed**
  - **Custom feeds** (NIP-51 list-backed)

- **Create/edit-like flow for custom feeds**:
  - Create feed with title/description
  - Topic filter via hashtags
  - Author filter via pubkeys
  - Include/exclude replies option
  - Save to Nostr using signed publish

- **Share/cross-client compatibility path**:
  - Custom feeds are published as **NIP-51 follow sets (kind 30000)** with `d`, `title`, `description`, `t`, `p` tags
  - Public feed discovery loads public kind-30000 events from relays

- **Bookmarks feed support**:
  - Reads latest bookmark list from **kind 10003** or **kind 30003**
  - Resolves saved event ids into feed timeline items

## Implemented feed types

- ✅ Following (contact list kind `3`)
- ✅ Global/Firehose
- ✅ WoT
- ✅ High Signal
- ✅ Custom topic feeds (hashtags)
- ✅ User-defined filters (hashtags/authors/reply inclusion)
- ✅ Saved/bookmarked content (kinds `10003` / `30003`)

## Nostr standards research summary

### NIP-51 (Lists)
- Relevant to compatibility and implemented:
  - kind `30000`: follow sets (parameterized via `d` tag)
  - kind `30003`: bookmark sets
  - kind `10003`: standard global bookmarks list
- This is the most interoperable baseline for feed definitions today.

### DVMs (NIP-90)
- NIP-90 defines request/result marketplace flow (`5000-6999`) for compute jobs.
- Valuable for advanced ranked/generated feeds, but **not required** for baseline cross-client feed storage.
- Current implementation keeps storage in NIP-51; DVM integration can be layered as optional feed generation backend.

### Primal-style alignment
- Primal publicly emphasizes custom feed management and marketplace/discovery UX.
- Implemented matching primitives here:
  - custom feed creation
  - feed picker
  - public feed discovery
  - Nostr-event-native persistence

## Files changed

- `frontend/src/lib/social.ts`
  - fixed following resolution
  - added custom feed model + parsers
  - added publish/load/discovery helpers for kind 30000
  - added bookmark-feed loader for 10003/30003
  - added custom-definition feed execution

- `frontend/src/pages/FeedPage.tsx`
  - added custom-feed UI + creation form
  - added saved/bookmarks feed option
  - added discovery chips for public feeds
  - integrated custom feed execution with existing timeline

## Verification

### Build
- Backend: `npm run build` ✅
- Frontend: `cd frontend && npm run build` ✅

### Tests
- `npm test` ✅
- Result: **34 passed, 34 total**

## Screenshots

Captured with Playwright:
- `ui-evidence/feeds-compatible-2026-02-27.png`
- `ui-evidence/feeds-compatible-feed-page-2026-02-27.png`

## Deploy to operator

Operator target: `neo@10.1.10.143`

Deployed changed files to:
- `/home/neo/strangesignal/projects/nostrmaxi-canonical/frontend/src/lib/social.ts`
- `/home/neo/strangesignal/projects/nostrmaxi-canonical/frontend/src/pages/FeedPage.tsx`
- `/home/neo/strangesignal/projects/nostrmaxi-canonical/FEEDS-COMPATIBLE-STATUS.md`

Remote verification on operator:
- `npm run build` ✅
- `npm test -- --runInBand src/__tests__/feed-modes.test.ts` ✅
- `cd frontend && npm run build` ✅

## Compatibility status

**Status: IMPLEMENTED (Nostr-native + cross-client compatible baseline)**

The feed system now uses NIP-51 list semantics for custom feeds, supports bookmark list feeds, and keeps default timeline modes functional and stable.
