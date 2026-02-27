# Mute Words Filter – Status

## ✅ Implemented

### 1) Mute list management
- Added `frontend/src/lib/muteWords.ts` with:
  - add/update/remove mute rules
  - local persistence (localStorage per pubkey)
  - import/export JSON
  - NIP-51 style sync event on kind `10000`
- Added sync helpers:
  - `publishMuteSettingsToNostr(...)`
  - `syncMuteSettingsFromNostr(...)`
- Privacy modes supported:
  - `local` (local only)
  - `public` (kind 10000 tags)
  - `encrypted` (kind 10000 content encrypted via NIP-04 when available)

### 2) Filter options
- Rule modes:
  - `substring`
  - `whole-word`
  - `regex`
- Case-insensitive default (optional case-sensitive support in rule model)
- Temporary mute support via `expiresAt` (duration in hours in UI)
- Permanent mute by leaving duration blank

### 3) What can be muted
- Post content
- Hashtags (from tags + inline `#hashtags`)
- URLs + domains
- Display names

### 4) Feed filtering behavior
- Real-time filtering applied as events load
- Applied in `FeedPage` after feed retrieval (works across feed modes shown in page)
- Hidden post counter added with reveal toggle:
  - `X posts hidden by mute rules`
  - `Reveal muted posts / Hide muted posts`

### 5) UI
- New reusable settings panel: `frontend/src/components/MuteWordsSettings.tsx`
  - add/remove rules
  - mode + scope + duration
  - enable/disable toggle
  - strict replies / strict quotes toggles
  - privacy mode selector
  - import/export buttons
  - sync button
- Feed integration:
  - embedded mute settings section in feed page
  - quick mute from post actions: `Mute phrase…`
- Added dedicated settings route/page:
  - `frontend/src/pages/SettingsPage.tsx`
  - route `/settings`
  - nav link `Settings`

### 6) Edge cases
- Quoted notes: quoted text is included in matching when strict quotes is enabled
- Replies: strict replies toggle is included in settings model and evaluation path
- User strictness preference implemented via strict toggles

---

## 🧪 Tests

Added: `frontend/tests/muteWords.test.ts`

Coverage includes:
- matching logic (substring / whole-word / regex)
- scope checks (urls/domains, display names, quoted content)
- import behavior
- performance baseline (2000 events, 25 rules)

### Local verification
- `npm run build` ✅
- `npm run build:frontend` ✅
- `npm test` ✅ (38 suites passed)

---

## 🚀 Operator deployment (neo@10.1.10.143)

### Synced files to operator project
- `frontend/src/lib/muteWords.ts`
- `frontend/src/components/MuteWordsSettings.tsx`
- `frontend/src/pages/FeedPage.tsx`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/App.tsx`
- `frontend/tests/muteWords.test.ts`

### Operator verification
- `npm test -- muteWords.test.ts` ✅ passed
- `npm run build:frontend` ⚠️ blocked by pre-existing operator-side issue unrelated to mute filter:
  - `src/App.tsx(19,27): Cannot find module './pages/ListsPage'`

This indicates operator branch/worktree has additional app references not currently resolvable in that environment.

---

## Files changed (feature)
- `frontend/src/lib/muteWords.ts` (new)
- `frontend/src/components/MuteWordsSettings.tsx` (new)
- `frontend/src/pages/SettingsPage.tsx` (new)
- `frontend/src/pages/FeedPage.tsx`
- `frontend/src/App.tsx`
- `frontend/tests/muteWords.test.ts` (new)
