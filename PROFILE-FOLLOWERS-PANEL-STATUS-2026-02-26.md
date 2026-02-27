# PROFILE FOLLOWERS/FOLLOWING PANEL STATUS — 2026-02-26

## Scope completed
Implemented profile inline followers/following panels with discover-style contact cards and profile-feed inline rendering parity with main feed renderer.

## What shipped

### 1) Clickable followers/following counts on Profile page
- Followers and Following count tiles are now buttons.
- Clicking opens/collapses an inline panel (`followers` or `following`).

### 2) Expandable/collapsible inline panel (no hard navigation)
- Inline panel appears directly on profile page.
- Includes explicit Close control.
- Supports pagination via `Load more`.

### 3) Contact-card rendering in panel (discover-style primitives)
- Dark-themed cards with avatar, identity line, bio excerpt, follower/following stats.
- NIP-05 first identity display with fallback name/npub truncation.

### 4) Panel controls
- Search/filter input (`NIP-05, name, npub`).
- Sort options: Followers, Following, Name.
- Follow/unfollow button per card with immediate optimistic UI update.

### 5) Follow state/count/list behavior
- Added unfollow behavior for kind:3 contact list updates.
- Added contact graph stats loader with cache+TTL for card follower/following numbers.
- Profile list membership/counts refresh/update after follow/unfollow actions.

### 6) Profile feed rendering parity with main feed
- Profile feed now uses same inline token pipeline as main feed:
  - `parseMediaFromFeedItem`
  - `InlineContent`
  - quoted event resolution (`extractQuoteRefsFromTokens` + `resolveQuotedEvents`)
- Removes raw text-only rendering path (`evt.content`) and uses renderer pipeline for links/quotes/images/video/audio and nostr ref transforms (note/nevent/npub/nprofile).

## Files changed (feature-specific)
1. `frontend/src/pages/ProfilePage.tsx`
2. `frontend/src/lib/social.ts`
3. `src/__tests__/profile-followers-panel-and-feed-parity.test.ts`

## Test evidence

### Build
- Command: `npm run build:all`
- Result: ✅ success

### Tests
- Command: `npm test`
- Result: ✅ 21 suites passed / 105 tests passed
- Includes new guard suite:
  - `src/__tests__/profile-followers-panel-and-feed-parity.test.ts`

## Screenshot evidence paths

- Expanded followers/following panel + profile inline-render evidence (composite):
  - `ui-evidence/profile-followers-panel-2026-02-26.html`
  - `ui-evidence/profile-followers-panel-2026-02-26.png`

## Deployment attempt
- Existing repo deployment doc is checklist-only (`DEPLOY.md`) and did not provide a concrete operator ssh/service restart target in this task context.
- No production restart executed from this run.

## Notes
- This repository is already in a heavily modified/uncommitted state unrelated to this task; file list above is limited to direct feature changes made in this run.
