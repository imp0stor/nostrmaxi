# NostrMaxi - Primitives Integration Plan

**Version:** 1.0  
**Created:** 2026-02-21  
**Target Start:** Upon primitive implementations completion  
**Estimated Duration:** 4-5 weeks  

---

## Overview

This plan details how to refactor NostrMaxi to use @strangesignal primitives instead of direct nostr-tools/NDK usage.

**Current State:**
- Phase A (backend): ✅ Complete, 81/81 tests passing
- Phase B (frontend): ✅ Complete, builds successfully
- Dependencies: nostr-tools v2.1.0 + NDK v2.14.0

**Target State:**
- Phase A+B using @strangesignal primitives
- Drop hard NDK dependency
- Maintain 100% backward compatibility in APIs
- Update WoT scoring model

---

## Module-by-Module Integration

### 1. Authentication Module (`src/auth/`)

#### Current Implementation
- Uses `nostr-tools`: `verifyEvent()`, `nip19`, `getPublicKey()`
- Implements NIP-42 challenge-response
- JWT session tokens

#### Changes Required

**File:** `src/auth/auth.service.ts`

```typescript
// BEFORE:
import { verifyEvent, nip19, getPublicKey } from 'nostr-tools';

// AFTER:
import { NostrProfilePrimitive } from '@strangesignal/nostr-profile';
import { AuthService as PrimitiveAuthService } from '@strangesignal/nostr-profile';

// Keep nostr-tools for crypto fallback (during transition)
import { verifyEvent as legacyVerify } from 'nostr-tools';
```

**Changes:**
1. Replace `verifyEvent()` → `NostrProfilePrimitive.verifySignature()`
2. Replace `nip19` → `NostrProfilePrimitive.encodeNpub()`
3. Replace `getPublicKey()` → `NostrProfilePrimitive.derivePublicKey()`

**Testing:**
- Run existing auth tests: `npm test -- auth.test.ts`
- Verify JWT still works
- Verify challenge-response unchanged

**Commit:**
```
feat(auth): integrate nostr-profile primitive for verification

- Replace nostr-tools verifyEvent with primitive
- Update key derivation to use primitive
- Maintain 100% API compatibility
- All auth tests passing
```

---

### 2. Nostr Service Module (`src/nostr/`)

#### Current Implementation
- Wraps NDK for relay queries
- Provides methods: `queryEvents()`, `getUserProfile()`, `getUserFollows()`, etc.
- Hard dependency on NDK initialization

#### Changes Required

**File:** `src/nostr/nostr.service.ts`

This is the most sensitive module. Changes here affect many other services.

**Strategy:** Keep NDK internally for relay queries, but add primitive wrappers.

```typescript
// Keep NDK for relay connectivity
import NDK from '@nostr-dev-kit/ndk';

// Add primitives for event handling
import { 
  ProfilePrimitive,
  ProfileMetadata 
} from '@strangesignal/nostr-profile';

// Implementation wrapper:
export class NostrService {
  private ndk: NDK;
  private profilePrimitive = new ProfilePrimitive();
  
  async getUserProfile(pubkey: string): Promise<ProfileMetadata> {
    // Step 1: Query via NDK (unchanged)
    const events = await this.queryEvents({ kinds: [0], authors: [pubkey] });
    
    // Step 2: Parse via primitive (NEW)
    if (events.length === 0) return null;
    return this.profilePrimitive.parse(events[0].content);
  }
}
```

**Sub-changes:**

1. **getUserProfile()** → Use ProfilePrimitive for parsing
2. **getRecentActivity()** → Keep as-is (internal utility)
3. **getFollowers/getFollowing()** → Use ProfilePrimitive for follow graph
4. **Episode/Show queries** → Keep as-is (will handle in content service)

**Testing:**
```bash
npm test -- nostr.test.ts
```

**Commit:**
```
refactor(nostr): wrap profile parsing with primitives

- Add ProfilePrimitive wrapper for getUserProfile
- Maintain NDK for relay queries
- Parse profiles per primitive spec
- No API changes to external consumers
```

---

### 3. WoT Module (`src/wot/`)

#### Current Implementation
- `wot.service.ts`: Score retrieval/storage
- `relay-wot.service.ts`: Manual WoT calculation (followers, following, activity)
- Scoring: Weighted formula based on followers, depth, activity

#### Changes Required

**Files:** 
- `src/wot/relay-wot.service.ts` (major refactor)
- `src/wot/wot.service.ts` (medium refactor)

**Strategy:** Replace manual scoring with nostr-wot-voting primitive model.

**Step 1: Create Primitive Wrapper** (`src/primitives/wot-voting.wrapper.ts`)

```typescript
import { WotVotingPrimitive } from '@strangesignal/nostr-wot-voting';
import { NostrService } from '../nostr/nostr.service';

export class WotVotingService {
  private primitive = new WotVotingPrimitive();
  
  constructor(private nostr: NostrService) {}
  
  /**
   * Get reputation score for a pubkey based on votes (kind 7400)
   */
  async getReputationScore(pubkey: string): Promise<{
    trustScore: number;
    votesReceived: number;
    upvotes: number;
    downvotes: number;
  }> {
    // Query kind 7400 vote events for this pubkey
    const votes = await this.nostr.queryEvents({
      kinds: [7400],
      '#p': [pubkey], // Votes targeting this pubkey
    });
    
    // Parse and aggregate via primitive
    return this.primitive.aggregateReputation(votes, pubkey);
  }
}
```

**Step 2: Update WoT Service**

```typescript
// src/wot/wot.service.ts

export class WotService {
  constructor(
    private prisma: PrismaService,
    private nostr: NostrService,
    private votingService: WotVotingService, // NEW
  ) {}
  
  async getScore(pubkey: string): Promise<WotScoreResponse> {
    // Old method: database lookup
    const user = await this.prisma.user.findUnique({ where: { pubkey } });
    
    // NEW: Combine database score with live vote reputation
    const voteReputation = await this.votingService.getReputationScore(pubkey);
    
    return {
      pubkey,
      trustScore: this.calculateTrustScore(user.wotScore, voteReputation),
      // ... rest of response
    };
  }
}
```

**Step 3: Update DB Schema**

Add to Prisma schema (`prisma/schema.prisma`):

```prisma
model WotScore {
  // ... existing fields ...
  
  // NEW: Vote-based reputation
  votesReceived Int @default(0)
  upvotes Int @default(0)
  downvotes Int @default(0)
  voteWeight Float @default(0) // Weighted votes
  updatedAt DateTime @updatedAt
}
```

**Scoring Algorithm Change**

Old formula:
```
trustScore = (followers/10) + (depth<3 ? 20 : 0) + activity_score
```

New formula:
```
trustScore = (votesReceived * voteWeight * 10) + 
             (followers/20) + 
             (accountAge_years * 5)
             
where voteWeight = (trustScore of voter / 100)
```

**⚠️ WARNING: This changes trust scores!** 

Need to:
- Generate migration: `npm run prisma:migrate`
- Test A/B scoring before rollout
- Communicate to users about changes

**Testing:**

```bash
# Unit tests
npm test -- wot.test.ts

# Integration: Verify scores reasonable
npm run test:e2e -- wot-scoring.e2e.ts
```

**Commits:**

```
feat(wot): integrate nostr-wot-voting primitive

- Replace manual WoT calculation with voting-based model
- Add kind 7400 vote event handling
- Implement vote aggregation
- Update trust score formula per primitive spec

BREAKING: Trust scores will change. See MIGRATION.md

refactor(db): add vote-based reputation fields

- Add votesReceived, upvotes, downvotes to WotScore
- Add voteWeight field for weighted reputation
- Update migration

chore(test): add WoT voting integration tests

- Test vote event parsing
- Test reputation aggregation
- Test backward compatibility
```

---

### 4. Content Service (`src/content/`)

#### Current Implementation
- Queries kind 31901 (episodes), 31900 (shows), 30018 (products), 31903 (bounties), 31905 (Q&A)
- Parses events via `parseShowEvent()`, `parseEpisodeEvent()`, etc.
- No primitive integration needed yet

#### Changes Required (OPTIONAL)

If nostr-kb primitive is complete, can add:
- Support kind 30023 (KB articles)
- Use primitive for KB parsing

Otherwise, keep as-is (no breaking changes needed).

**Minimal Change:**

```typescript
// src/content/content.service.ts

// Add (if primitive exists):
import { KbArticlePrimitive } from '@strangesignal/nostr-kb';

async getKbArticles(limit = 20): Promise<KbArticle[]> {
  const events = await this.nostr.queryEvents({
    kinds: [30023],
    limit,
  });
  
  return events.map(e => new KbArticlePrimitive().parse(e));
}

// Keep everything else unchanged
```

**Commit (if applicable):**

```
feat(content): add nostr-kb article support (optional)

- Add KB article queries (kind 30023)
- Integrate KB primitive for article parsing
- Add KbArticle type to content service
```

---

### 5. Frontend Updates (`frontend/src/`)

#### Current Implementation
- Uses `nostr-tools` for event signing/key derivation
- WoT UI components display static scores

#### Changes Required

**File:** `frontend/src/lib/nostr.ts`

```typescript
// BEFORE:
import { getPublicKey, generateSecretKey } from 'nostr-tools';

// AFTER:
// Keep nostr-tools for crypto, replace for primitives
import { getPublicKey } from 'nostr-tools'; // Keep for now

// Use primitives for profile operations:
import { ProfilePrimitive } from '@strangesignal/nostr-profile-react';

const profilePrimitive = new ProfilePrimitive();
```

**File:** `frontend/src/components/wot/WotScoreBadge.tsx`

```typescript
// BEFORE:
<div className={`score-${score < 50 ? 'low' : 'high'}`}>
  {score}
</div>

// AFTER (if scoring changes):
<div className={`score-${score < 25 ? 'low' : score < 75 ? 'medium' : 'high'}`}>
  {score}
  <span className="text-xs">(vote-weighted)</span>
</div>
```

**Testing:**

```bash
cd frontend
npm run build    # Should still succeed
npm run lint     # Check for unused imports
```

**Commits:**

```
refactor(frontend): update imports for primitives

- Remove direct nostr-tools usage where possible
- Use profile primitive wrappers
- Maintain all existing functionality

chore(frontend): update WoT score display

- Add vote-weighting indicator
- Update color thresholds if needed
- Update tooltips to explain new scoring
```

---

## Database Migration Strategy

### Create Migration

```bash
cd /home/owner/strangesignal/projects/nostrmaxi

# Generate migration file
npm run prisma:migrate -- --name add_vote_reputation

# Edit generated migration if needed
```

### Migration Contents (SQL)

```sql
-- Add vote-based reputation fields
ALTER TABLE "WotScore" ADD COLUMN "votesReceived" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WotScore" ADD COLUMN "upvotes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WotScore" ADD COLUMN "downvotes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WotScore" ADD COLUMN "voteWeight" FLOAT NOT NULL DEFAULT 0.0;

-- Create index for efficient vote queries
CREATE INDEX "WotScore_votesReceived_idx" ON "WotScore"("votesReceived" DESC);
```

### Rollback Plan

Keep old scoring data during transition:

```sql
-- Backup old scores
ALTER TABLE "WotScore" ADD COLUMN "legacyTrustScore" INTEGER;
UPDATE "WotScore" SET "legacyTrustScore" = "trustScore";

-- Can revert if needed:
-- UPDATE "WotScore" SET "trustScore" = "legacyTrustScore";
```

---

## Testing Checklist

### Unit Tests

- [ ] `npm test` - All 81 existing tests pass
- [ ] New primitive wrapper tests pass
- [ ] Auth tests pass (verifyEvent replacement)
- [ ] WoT tests pass (new scoring logic)
- [ ] Profile parsing tests pass

### Integration Tests

- [ ] Auth flow: challenge → verify → JWT
- [ ] WoT scoring: votes → reputation → trust score
- [ ] Content: queries → parsing → DB storage
- [ ] No regressions in API responses

### Manual Testing

- [ ] Login works
- [ ] Feed loads and filters by WoT
- [ ] WoT scores display correctly (may differ from old scores)
- [ ] Content search works
- [ ] No console errors

### Smoke Tests

```bash
# Build both backend and frontend
npm run build:all

# Run all tests
npm test

# Check for TS errors
npx tsc --noEmit
```

---

## Rollout Strategy

### Phase 1: Local Testing (Week 1)
1. Checkout `refactor/primitives-integration` branch
2. Implement all changes
3. Run all tests locally
4. Manual testing on localhost:3000

### Phase 2: Staging (Week 2)
1. Deploy to staging
2. Run smoke tests
3. Collect baseline WoT scores (new vs old)
4. Performance testing (no regressions)

### Phase 3: User Communication (Week 3)
1. Announce WoT scoring change
2. Document in changelog
3. Provide FAQ about new scoring

### Phase 4: Production (Week 4)
1. Tag v1.1.0-beta
2. Deploy to production
3. Monitor error rates
4. Collect user feedback

### Phase 5: Release (Week 5)
1. If stable: Tag v1.1.0 release
2. Update documentation
3. Archive this plan

---

## Rollback Procedure

If critical issues occur:

```bash
# Revert to v1.0.0
git checkout v1.0.0
npm install
npm run prisma:migrate:prod  # Use legacyTrustScore data

# Push to production
docker build -f Dockerfile.prod -t nostrmaxi:1.0.0 .
docker push ...
```

---

## File Checklist - Changes Required

### Backend

- [ ] `src/auth/auth.service.ts` - Import primitives, replace verifyEvent
- [ ] `src/nostr/nostr.service.ts` - Add ProfilePrimitive wrapper
- [ ] `src/primitives/wot-voting.wrapper.ts` - NEW FILE
- [ ] `src/wot/wot.service.ts` - Integrate WotVotingService
- [ ] `src/wot/relay-wot.service.ts` - Keep for now (fallback)
- [ ] `src/content/content.service.ts` - Optional: add KB support
- [ ] `prisma/schema.prisma` - Add vote reputation fields
- [ ] `package.json` - Add primitive packages, bump nostr-tools
- [ ] `jest.config.js` - No changes needed (if tests update)
- [ ] `.gitignore` - No changes needed

### Frontend

- [ ] `frontend/src/lib/nostr.ts` - Update imports
- [ ] `frontend/src/components/wot/WotScoreBadge.tsx` - Update display logic
- [ ] `frontend/package.json` - Add primitive packages
- [ ] `frontend/src/types/index.ts` - Update primitive types

### Documentation

- [ ] `ARCHITECTURE-AUDIT.md` - ✅ DONE
- [ ] `PRIMITIVES-INTEGRATION-PLAN.md` - ✅ THIS FILE
- [ ] `MIGRATION.md` - NEW: User migration guide
- [ ] `README.md` - Update with primitives usage
- [ ] `CHANGELOG.md` - Record v1.1.0 changes

---

## Success Criteria

### Code Quality
- ✅ TypeScript strict mode: 0 errors
- ✅ All tests passing (81+)
- ✅ No console warnings
- ✅ Build succeeds (both backend and frontend)

### Functionality
- ✅ Auth unchanged (API compatible)
- ✅ WoT scoring working (new formula)
- ✅ Content queries work
- ✅ Frontend renders correctly

### Performance
- ✅ Build time < 30s
- ✅ Test time < 10s
- ✅ No memory leaks
- ✅ No performance regression

### User Experience
- ✅ No breaking changes to API
- ✅ Trust scores reasonable
- ✅ No lost functionality
- ✅ Clear changelog

---

## Post-Integration Tasks

Once integration complete:

1. **Close GitHub issues**
   - Close: "Refactor to use primitives"
   - Link merged PR

2. **Update documentation**
   - Add primitives usage guide
   - Update architecture docs
   - Add migration notes for operators

3. **Knowledge Base Article**
   - Document integration process
   - Share lessons learned
   - Archive this plan

4. **Plan Phase C**
   - User profiles (Phase C)
   - Social features
   - Depends on primitives stability

---

## Dependencies & Blockers

### Blockers (Must Complete First)
- [ ] `@strangesignal/nostr-profile` - v1.0.0 stable
- [ ] `@strangesignal/nostr-wot-voting` - v1.0.0 stable

### Not Blocking (Can be concurrent)
- [ ] `@strangesignal/nostr-kb` - Additive, not required
- [ ] Phase C planning - Can proceed in parallel

---

## References

- **Architecture Audit:** `ARCHITECTURE-AUDIT.md`
- **Primitive Specs:** `/home/owner/strangesignal/standards/primitives/`
- **Current Build Status:** ✅ Phase A+B complete
- **Tests:** `src/__tests__/` (81 passing)

---

## Sign-Off

**Plan Created:** 2026-02-21  
**Prepared by:** Subagent - NostrMaxi Validator  
**Status:** Ready for Implementation (awaiting primitive implementations)  
**Next Steps:** Coordinate with main agent on primitive readiness

---

**How to Use This Plan:**

1. Once primitives are ready, start with "Module-by-Module Integration"
2. Follow testing checklist after each module
3. Reference file checklist to ensure nothing missed
4. Use rollout strategy for safe deployment
5. Archive this plan when complete
