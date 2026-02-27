# Discover / WoT / NIP-05 / Embedded Quotes / Media Fix Status (2026-02-26)

## Scope completed
Implemented and verified in code:

1. **Discover IA** now supports entity tabs:
   - Users (default)
   - Relays
   - Posts
   - Similar

2. **Users discover behavior**:
   - Excludes already-followed users by default in discover pools
   - Added optional Following view separated from default discovery
   - Follow button state updates optimistically in-place
   - Background revalidation after follow action

3. **Follower count hydration**:
   - Added `follower_count`/`following_count` compatibility mapping
   - Added follower backfill from contact events for better card counts

4. **WoT relevance improvements**:
   - Added explicit scoring signals:
     - `proximityScore` (1-hop/2-hop)
     - `interactionScore` (mentions/interactions by network)
     - `relayAffinityScore` (relay-tag affinity)
   - Updated ranking formula to prioritize social proximity + network interactions
   - Added discover reason labels in UI (e.g. followed by your network, relay/network signals)

5. **NIP-05 external display regression fixes**:
   - Added strict NIP-05 validator (`isValidNip05`)
   - NIP-05-first display with fallback chain
   - Applied to discover and profile rendering surfaces
   - Fixed profile route `npub` decode path to pubkey

6. **Embedded event quote rendering (quote-tweet style)**:
   - Parses refs from `e` tags and `nostr:note/nevent` in content
   - Resolves referenced events
   - Renders nested quote cards in feed
   - Graceful fallback: “Quoted event unavailable” card

7. **Media eager image rendering fixes**:
   - Improved media parser to include imeta image URLs (even no extension)
   - In-viewport strategy: first two images eager/high-priority
   - Added loading skeleton, error state, retry + open-link fallback
   - Multi-image rendering kept with `object-cover`, no permanent blank state

---

## Key changed files (concise)

- `frontend/src/pages/DiscoverPage.tsx`
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/pages/FeedPage.tsx`
- `frontend/src/lib/social.ts`
- `frontend/src/lib/profileCache.ts`
- `frontend/src/lib/media.ts`
- `frontend/src/lib/discoverState.ts`
- `frontend/src/lib/discoverEntities.ts`
- `frontend/src/lib/quotes.ts`
- `frontend/src/components/RichMedia.tsx`
- `frontend/src/components/QuotedEventCard.tsx`
- `frontend/src/types/discover.ts`

Tests added/updated:
- `src/__tests__/discover-state.test.ts`
- `src/__tests__/discover-ranking.test.ts`
- `src/__tests__/nip05-display.test.ts`
- `src/__tests__/media-parsing.test.ts`

---

## Verification outputs

### Build / test gates
- `npm run build` ✅
- `npm run build:frontend` ✅
- `npm test` ✅

Latest test summary:
- **16 suites passed, 16 total**
- **89 tests passed, 89 total**

### Operator deploy
- Synced to Operator:
  - `/home/neo/strangesignal/projects/nostrmaxi-canonical`
- Rebuilt frontend on Operator ✅
- Restarted frontend static serve on `:3402` ✅
- Listener verified:
  - `ss -ltnp | rg 3402` => `LISTEN ... :3402`

---

## Evidence paths

- `ui-evidence/discover-fixes-2026-02-26/discover-users-default.png`
- `ui-evidence/discover-fixes-2026-02-26/discover-relays-tab.png`

Note: Browser-control service on host timed out during this run, so evidence capture used Playwright CLI screenshot path. If you want authenticated in-app tab-by-tab screenshots (Users/Relays/Posts/Similar + quote cards + eager images in feed), I can run a scripted authenticated Playwright flow next and output dedicated screenshots per requirement.

---

## Scoring approach (transparent)

In `loadCuratedDiscoverUsers`:
- `proximityScore = 0.6 * normalized(overlap) + 0.4 * normalized(secondHop)`
- `interactionScore = normalized(network interactions)`
- `relayAffinityScore = normalized(network relay-tag affinity)`
- Final score blend:
  - 34% WoT followers
  - 26% proximity
  - 18% interaction
  - 10% relay affinity
  - 8% recent activity
  - 4% verified NIP-05

This keeps Discover focused on **new entities with social proximity relevance**, not already-followed accounts.
