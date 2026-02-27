# FEED MODES + INFINITE SCROLL STATUS (2026-02-26)

## ✅ Implemented

### 1) Feed mode selector
Added feed mode selector to `FeedPage` with all required modes:
- Firehose (`firehose`) — global latest chronological
- Following (`following`) — only followed users chronological
- WoT (`wot`) — 1-2 hop network with proximity scoring
- High Signal (`high-signal`) — interaction/zap weighted ranking

### 2) Infinite scroll for all modes
Implemented IntersectionObserver-based infinite scroll in `FeedPage`:
- Auto-load next page when sentinel enters viewport
- Dedicated loading-more state (`Loading more events…`)
- Cursor-based pagination (`nextCursor` from oldest `created_at - 1`)
- Dedupe by event id when appending pages

### 3) Distinct query/ranking logic per mode
Implemented mode-specific logic in `frontend/src/lib/social.ts`:
- **Firehose**: `querySync({ kinds, limit, until })` sorted by `created_at desc`
- **Following**: queries authors from follow list + self, chronological
- **WoT**:
  - builds second-hop graph from follows' contact lists
  - scores events via proximity (`following=2`, `second-hop=1`, other=0.25)
  - sorts by score desc, then recency
- **High Signal**:
  - loads base events page
  - fetches interactions (`kinds: [7,6,9735,1]`, `#e` references)
  - scores events with weighted interactions (`zap=3`, repost=2, like=1, reply=1)
  - sorts by score desc, then recency

### 4) Persist selected mode preference
`localStorage` persistence added in `FeedPage`:
- key: `nostrmaxi.feed.mode`
- initial mode restored on page load
- updates on mode switch

### 5) Existing inline rendering kept
`InlineContent` rendering path unchanged. Existing media/quote/link/audio inline rendering remains intact.

### 6) Tests for mode logic + infinite-scroll pagination behavior
Added tests in:
- `src/__tests__/feed-modes.test.ts`

Coverage includes:
- WoT ranking priority (following > second-hop > others)
- High Signal weighted interaction/zap scoring
- Cursor pagination (`oldest created_at - 1`) used for infinite scroll

### 7) Deploy to operator
Attempted deployment via:
- `./scripts/deploy.sh --skip-pull`

Result:
- Initial failure: missing `logs/` directory (fixed by creating dir)
- Blocking failure after retry: **Docker daemon is not running**
- Deployment could not complete in current environment until Docker is running

---

## Validation

Executed successfully:
- `npm run build`
- `npm run build:frontend`
- `npm test`

Test result summary:
- **26/26 suites passed**
- **117/117 tests passed**

---

## Changed files (this task)

- `frontend/src/pages/FeedPage.tsx`
  - mode selector UI
  - persisted mode preference
  - infinite scroll sentinel + loading states
  - paginated loading orchestration
- `frontend/src/lib/social.ts`
  - `FeedMode`, `FeedQuery`, expanded `FeedDiagnostics`
  - cursor pagination (`nextCursor`)
  - mode-specific feed loading/ranking logic
  - exported helper scorers for testability
- `src/__tests__/feed-modes.test.ts`
  - tests for WoT/high-signal ranking + cursor pagination behavior
- `ui-evidence/feed-modes-infinite-scroll.png`
  - screenshot artifact

---

## Screenshot

Saved:
- `ui-evidence/feed-modes-infinite-scroll.png`
