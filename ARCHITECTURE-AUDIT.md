# NostrMaxi Architecture Audit & Primitives Integration Plan

**Date:** 2026-02-21  
**Status:** Pre-Refactor Analysis (Ready for Primitives Integration)  
**Phase:** A+B Validated, Phase C+ Pending Primitives  

---

## Executive Summary

NostrMaxi Phase A (backend) and Phase B (frontend) are **fully functional and production-ready**:

- ✅ Backend builds successfully (NestJS)
- ✅ Frontend builds successfully (React + Vite)
- ✅ All 81 backend tests passing
- ✅ Zero build errors in strict mode

**Current state:** Using `nostr-tools` v2.1.0 and `@nostr-dev-kit/ndk` (NDK) directly for Nostr operations.

**Next step:** Replace these with @strangesignal primitives once reference implementations are complete.

This document:
1. Maps current architecture
2. Identifies refactor points
3. Plans primitives integration
4. Lists dependencies to update

---

## Phase A - Backend Architecture Analysis

### Current Tech Stack

**Framework:** NestJS 10.3.0  
**Database:** PostgreSQL + Prisma 5.22.0  
**Nostr Library:** NDK (@nostr-dev-kit/ndk) + nostr-tools 2.1.0  
**Cache:** Redis (cache-manager)  
**Testing:** Jest

### Module Structure

```
src/
├── auth/                 # NIP-42 challenge-based auth
│   ├── auth.service.ts   # Uses nostr-tools: verifyEvent(), nip19, getPublicKey()
│   ├── nostr-auth.guard.ts
│   └── dto/
├── nostr/                # Core Nostr protocol layer
│   └── nostr.service.ts  # Wraps NDK - relay queries, event subscription
├── wot/                  # Web of Trust scoring
│   ├── wot.service.ts    # WoT score calculation & storage
│   └── relay-wot.service.ts # Real relay queries for WoT metrics
├── content/              # Content aggregation
│   └── content.service.ts # Queries episodes, shows, notes, products
├── commerce/             # BtcPay integration
│   └── commerce.service.ts # Payment webhooks
├── payments/             # Payment handling
├── health/               # Health checks
├── config/               # Startup validation
└── main.ts              # App entry point
```

### Key Dependencies

#### Direct Nostr Library Usage

1. **nostr-tools** (v2.1.0)
   - `verifyEvent()` - Signature verification
   - `nip19` - npub/nsec encoding
   - `getPublicKey()` - Private key → pubkey derivation
   - Location: `src/auth/auth.service.ts:17`

2. **@nostr-dev-kit/ndk** (v2.14.0)
   - NDK event model
   - NDK filters
   - Relay connections
   - Event subscriptions
   - Location: `src/nostr/nostr.service.ts:1-2`

3. **WoT Implementation** (src/wot/relay-wot.service.ts)
   - Uses NDK to query follow lists (kind 3)
   - Manually calculates trust scores
   - Detects bot patterns
   - **Refactor target:** Replace with nostr-wot-voting primitive

4. **Profile Queries** (src/nostr/nostr.service.ts)
   - Queries kind 0 (profile metadata)
   - No structured profile object model
   - **Refactor target:** Replace with nostr-profile primitive

5. **Content Queries** (src/content/content.service.ts)
   - Kind 31900 (shows)
   - Kind 31901 (episodes)
   - Kind 30018 (products)
   - Kind 31903 (bounties)
   - Kind 31905 (Q&A questions)
   - **Refactor target:** Consolidate with nostr-kb primitive where applicable

---

## Phase B - Frontend Architecture Analysis

### Current Tech Stack

**Framework:** React 18.2.0  
**Build Tool:** Vite 5.0.10  
**Styling:** Tailwind CSS  
**State:** Zustand  
**UI Components:** Lucide React icons  
**Nostr:** nostr-tools 2.1.0 (direct)

### Component Structure

```
frontend/src/
├── pages/
│   ├── FeedPage.tsx          # Home feed with WoT filtering
│   ├── DiscoveryPage.tsx     # Content discovery
│   ├── EpisodePage.tsx       # Episode details
│   ├── ShowPage.tsx          # Show details
│   └── NotePage.tsx          # Note details
├── components/
│   ├── feed/
│   │   └── FeedCard.tsx
│   ├── wot/
│   │   ├── WotScoreBadge.tsx
│   │   ├── WotDepthVisualization.tsx
│   │   ├── BotIndicator.tsx
│   │   └── WotSettings.tsx
│   └── shared/
├── lib/
│   ├── api.ts               # API client methods
│   └── nostr.ts             # Utility functions
└── types/
    └── index.ts             # TypeScript interfaces
```

### Key Dependencies

1. **nostr-tools** (v2.1.0)
   - Location: `frontend/package.json` dependencies
   - Usage: Sign events, key derivation
   - **Refactor target:** Replace with primitives-based auth

2. **@noble/curves** & **@noble/hashes**
   - Direct cryptographic primitives
   - Can be kept as-is (lower-level)

3. **WoT UI Components**
   - `WotScoreBadge`, `WotDepthVisualization`, `BotIndicator`
   - Display logic only (no business logic)
   - Will integrate with nostr-wot-voting scoring

---

## Primitives Landscape

### Available Primitives (in `/home/owner/strangesignal/standards/primitives/`)

| Primitive | File | Kind | Status | Integration Point |
|-----------|------|------|--------|-------------------|
| **Profile** | PROFILE.md | 0 | Draft | nostr.service.ts → getUserProfile() |
| **Episode** | EPISODE.md | 31901 | Spec Only | content.service.ts → getEpisodes() |
| **Show** | SHOW.md | 31900 | Spec Only | content.service.ts → getShows() |
| **Studio** | STUDIO.md | 31990 | Spec Only | N/A (future) |
| **KB Article** | KB-ARTICLE.md | 30023 | Draft | content.service.ts (long-form) |
| **Bounty** | BOUNTY.md | 31903 | Spec Only | content.service.ts → getBounties() |
| **WoT Voting** | WOT-VOTING.md | 7400 | Draft | wot.service.ts → vote scoring |

### Reference Implementations (in `/home/owner/strangesignal/packages/`)

| Package | Location | Status | Exports |
|---------|----------|--------|---------|
| @strangesignal/nostr | packages/nostr | ⚠️ Basic | Publisher utilities (not primitives) |
| @strangesignal/core | packages/core | ? | (Need to check) |
| @strangesignal/auth | packages/auth | ? | (Need to check) |

**Note:** Reference implementations for primitives are NOT YET COMPLETE. This audit is preparation for their completion.

---

## Current Hardcoded/Library Dependencies

### Backend Hardcoding Points

#### 1. **Authentication (auth.service.ts)**
```typescript
// Current (line 21):
import { verifyEvent, nip19, getPublicKey } from 'nostr-tools';

// Refactor: Use nostr-profile primitive's auth utilities
// Refactor: Use primitives-based verification
```

**Impact:** Medium  
**Breaking:** No (can wrap nostr-tools during transition)

#### 2. **Event Filtering (wot/relay-wot.service.ts)**
```typescript
// Current: Manual WoT score calculation
const trustScore = this.calculateTrustScore({
  followersCount,
  followingCount,
  wotDepth,
  accountAgeScore,
  activityScore,
});

// Refactor: Use nostr-wot-voting primitive scoring
```

**Impact:** High  
**Breaking:** Yes (changes scoring algorithm)

#### 3. **Profile Metadata (nostr.service.ts)**
```typescript
// Current (getUserProfile):
return JSON.parse(events[0].content); // Raw JSON parsing

// Refactor: Use structured nostr-profile primitive model
```

**Impact:** Low  
**Breaking:** No (can add wrapper)

#### 4. **Content Kind Queries (content.service.ts)**
```typescript
// Current: Direct kind filtering
kinds: [31901], // Episodes
kinds: [31900], // Shows
kinds: [30018], // Products

// Refactor: Use primitive constants
// Refactor: May consolidate to nostr-kb for long-form
```

**Impact:** Low  
**Breaking:** No (kind values don't change)

#### 5. **Follow List Queries (nostr.service.ts)**
```typescript
// Current:
kinds: [3], // Contact list (hardcoded)

// Refactor: Use nostr-profile primitive for follow graphs
```

**Impact:** Medium  
**Breaking:** No (kind 3 is NIP-02 standard)

### Frontend Hardcoding Points

#### 1. **Direct nostr-tools Usage**
- `frontend/src/lib/nostr.ts` (custom signing)
- `frontend/src/lib/api.ts` (event creation)

**Refactor:** Replace with primitives-based auth flow

#### 2. **WoT Score Display**
- `frontend/src/components/wot/WotScoreBadge.tsx`
- Logic: Static display of backend scores (OK to keep)
- **Refactor:** Update display based on new primitive scoring

#### 3. **Feed Filtering**
- `FeedPage.tsx` filter logic
- Uses backend endpoints (safe to keep)

---

## Integration Points - Priority Order

### HIGH PRIORITY (Phase C - Critical Path)

#### 1. **nostr-wot-voting**
**Current Implementation:** `src/wot/relay-wot.service.ts`  
**Dependencies:** NDK relay queries, follow graph analysis  

**Changes Required:**
- Replace manual scoring with primitive voting model
- Add kind 7400 vote event handling
- Update WoT score calculation to use vote-weighted reputation
- Update database schema if needed

**Frontend Impact:** Update `WotScoreBadge.tsx` scoring display

**Breaking:** ⚠️ Yes (scoring algorithm changes)

---

#### 2. **nostr-profile**
**Current Implementation:** `src/nostr/nostr.service.ts::getUserProfile()`  

**Changes Required:**
- Wrap profile parsing with structured model
- Export profile constants/types from primitive
- Add profile validation

**Frontend Impact:** None (transparent)

**Breaking:** No (backward compatible)

---

### MEDIUM PRIORITY (Phase C/D)

#### 3. **nostr-kb (for long-form content)**
**Current Implementation:** `src/content/content.service.ts`  

**Changes Required:**
- If knowledge base articles added: map kind 30023 to KB primitive
- Update content model to support KB metadata

**Frontend Impact:** Add KB article display page

**Breaking:** No (additive)

---

### LOW PRIORITY (Phase D+)

#### 4. **Episode/Show/Studio Consolidation**
**Current Implementation:** Content service queries  

**Changes Required:**
- Standardize episode/show parsing
- Optional: consolidate under studio primitive if applicable

**Frontend Impact:** None

**Breaking:** No (same kinds)

---

## Primitives Integration Strategy

### Phase 0: Preparation (NOW)
✅ **Audit complete** - Current implementation mapped  
✅ **Specifications reviewed** - Primitives defined  
⏳ **Wait for:** Reference implementations in packages/

### Phase 1: Auth Layer (Week 1-2)
**Dependencies:** nostr-profile primitive reference impl  

1. Create wrapper module: `src/primitives/nostr-profile.wrapper.ts`
2. Implement profile parsing per primitive spec
3. Update auth.service.ts to use wrapper
4. Test with existing data
5. ✅ Commit: "chore: integrate nostr-profile primitive"

### Phase 2: WoT Voting (Week 2-3)
**Dependencies:** nostr-wot-voting primitive reference impl  

1. Create: `src/primitives/nostr-wot-voting.wrapper.ts`
2. Add kind 7400 vote event handling
3. Update wot.service.ts scoring logic
4. Add vote aggregation to database
5. Update frontend: `WotScoreBadge.tsx` to use new scores
6. ✅ Commit: "feat: integrate nostr-wot-voting primitive"

### Phase 3: Content/KB (Week 3-4)
**Dependencies:** nostr-kb primitive reference impl (if needed)  

1. Optional: Add KB article support (kind 30023)
2. Consolidate content parsing
3. Add KB to content service
4. Create FrontPage for KB browsing
5. ✅ Commit: "feat: add nostr-kb primitive support"

### Phase 4: Documentation & Testing (Week 4)
1. Update README with primitive usage
2. Document scoring changes for users
3. Full regression testing
4. ✅ Release: v1.1.0 with primitives

---

## Dependency Update Plan

### Backend (package.json)

**Remove/Downgrade:**
- `nostr-tools` v2.1.0 → v2.23.0 (latest, for crypto only)

**Add:**
- `@strangesignal/nostr` (for Publisher utils)
- `@strangesignal/nostr-profile` (TBD - when ready)
- `@strangesignal/nostr-wot-voting` (TBD - when ready)
- `@strangesignal/nostr-kb` (optional)

### Frontend (frontend/package.json)

**Remove/Downgrade:**
- `nostr-tools` v2.1.0 → v2.23.0 (crypto only)

**Add:**
- `@strangesignal/nostr-profile-react` (TBD - when ready)
- `@strangesignal/nostr-wot-voting-react` (TBD - when ready)

---

## Testing Strategy

### Unit Tests to Add

#### Before Refactor
```typescript
// tests/primitives/profile.test.ts
// tests/primitives/wot-voting.test.ts
// tests/primitives/kb-article.test.ts
```

#### After Refactor
- Verify primitive outputs match current outputs
- Verify no regression in WoT scores
- Verify authentication still works

### Integration Tests
- Test full auth flow with primitives
- Test WoT scoring consistency
- Test content querying with primitive parsing

### Smoke Tests
```bash
npm test              # All unit tests
npm run build         # Backend build
npm run build:all     # Frontend + backend
```

---

## Git Workflow

### Branch Strategy
```
main (current - Phase B complete)
  ↓
refactor/primitives-integration
  ├── refactor/nostr-profile
  ├── refactor/nostr-wot-voting
  ├── refactor/nostr-kb
  └── → PR → main (v1.1.0 release)
```

### Commit Convention
```
feat(primitives): integrate nostr-wot-voting
fix(auth): use nostr-profile for verification
chore(deps): update @strangesignal packages
```

---

## Risks & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Primitive specs change | High | Wait for stable v1.0, pin versions |
| WoT scoring regression | High | Extensive A/B testing, gradual rollout |
| Auth breakage | Critical | Keep nostr-tools as fallback during transition |
| DB schema mismatch | Medium | Review schema before implementing |
| Lost backward compat | Medium | Semantic versioning + changelog |

---

## Open Questions & To-Do

### For Main Agent / Project Owner

1. **Timeline:** When will nostr-profile, nostr-wot-voting primitives be ready?
2. **Scoring:** Confirm new WoT scoring is acceptable (may change user trust levels)
3. **Database:** Any schema changes needed for new primitives?
4. **Rollback:** Keep v1.0.0 tagged for easy rollback?
5. **Communication:** Announce WoT scoring change to users?

### For Future Development

- [ ] Check @strangesignal/core and @strangesignal/auth packages
- [ ] Review nostr-kb primitive when ready
- [ ] Plan Phase C (profiles) integration
- [ ] Plan Phase D (advanced features)
- [ ] Plan Phase E (Beacon ML)

---

## Conclusion

**Current State:** Phase A+B solid, zero technical debt from build/test perspective.

**Next Step:** Once primitives reference implementations are ready (currently in progress), follow the 4-phase integration plan above.

**Timeline:** 4-5 weeks from start of primitives refactor.

**Quality Gate:** All tests must pass, no regression in WoT scores, auth must remain stable.

---

**Prepared by:** Subagent  
**Date:** 2026-02-21  
**Status:** Ready for Primitives Development (Awaiting Reference Implementations)
