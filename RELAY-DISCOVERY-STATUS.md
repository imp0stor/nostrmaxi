# Relay Discovery Redesign Status

## Objective
Redesign Discover → Relays so users are shown relays they **do not** already have configured, with one-click add and persistence.

## Completed

### 1) Current relay list fetch (NIP-65 first, app state fallback)
- Implemented `fetchUserRelayList(pubkey, fallbackRelays)` in `frontend/src/pages/DiscoverPage.tsx`.
- Behavior:
  - Attempts NIP-65 read (`kind: 10002`) from discovery relays.
  - Parses `r` tags into relay URLs.
  - Falls back to app state/local storage relays if no NIP-65 event is available.
- Normalizes relay URLs to avoid duplicate variants.

### 2) Recommended relays exclude configured relays
- Added recommendation engine in `frontend/src/lib/discoverEntities.ts`:
  - `suggestedRelays({ configuredRelays, userRegion, preferredTopics, limit })`
- Filters out relays already in user configuration.

### 3) Recommendation ranking signals implemented
Recommendation score now combines:
- **Popular/reliable relays**: reliability + uptime + popularity scores
- **Geographic proximity**: locale-derived regional affinity
- **Topic/community focus**: overlap with inferred user topics
- **Network usage data**: activity score + monthly active users

### 4) Discover UI updated with “Suggested Relays”
- Updated `frontend/src/pages/DiscoverPage.tsx` relay tab UI:
  - New **Suggested Relays** section
  - Relay cards include:
    - URL
    - Description
    - Reliability + uptime
    - User/activity metrics
    - Region/topic indicators
    - Recommendation reason
  - **Add Relay** button per card

### 5) Easy relay management + persistence
- Add relay in one click:
  - Updates in-memory relay list
  - Persists to `localStorage` (`nostrmaxi_connected_relays`)
  - Attempts to publish updated relay set as NIP-65 (`kind: 10002`) via signer and relay publish path

## Tests
- Added unit tests: `src/__tests__/relay-discovery.test.ts`
  - Verifies configured relays are excluded from suggestions
  - Verifies ranking output and recommendation metadata

## Files Changed
- `frontend/src/lib/discoverEntities.ts`
- `frontend/src/pages/DiscoverPage.tsx`
- `src/__tests__/relay-discovery.test.ts`
- `RELAY-DISCOVERY-STATUS.md`
