# Database Architecture Audit

**Date**: 2026-02-27  
**Principle**: Relay = Nostr Database, PostgreSQL = Only Non-Nostr Supplemental Data

---

## ✅ Correct: Keep in PostgreSQL

These tables store **business logic** and **non-Nostr data** that can't be represented as Nostr events:

### 1. **User** ✅
- Maps Nostr pubkeys to internal IDs
- Needed for foreign key relations
- Not duplicating Nostr data (just linking)

### 2. **Session** ✅
- JWT tokens for auth
- Session management state
- Not Nostr-queryable

### 3. **AuthChallenge** ✅
- Challenge-response auth state
- Temporary, expires quickly
- Internal to our auth flow

### 4. **LnurlSession** ✅
- LNURL-auth state machine
- k1 challenges, linking keys
- Our payment flow logic

### 5. **ApiKey & ApiKeyUsage** ✅
- API key management
- Rate limiting state
- Usage tracking for billing
- Our service business logic

### 6. **Nip05** ✅
- **Our product** - NIP-05 registrations
- user@domain.com mappings
- Payment linkage
- Domain verification state

### 7. **Domain** ✅
- Custom domain ownership
- DNS verification state
- Our domain management service

### 8. **Subscription** ✅
- Payment tier state
- Billing lifecycle
- Expiration tracking
- Our business model

### 9. **Payment** ✅
- Invoice records
- Payment provider state (BTCPay, LNbits, Stripe)
- Receipt numbers
- Financial records (can't be in relay)

### 10. **AuditLog** ✅
- Admin action history
- Compliance/security
- Internal operations log

---

## ❌ Should Remove from PostgreSQL

### **WotScore** ❌ MOVE TO RELAY QUERIES

**Problem**: This is derived from Nostr data (follows/contacts)

**Current state**:
```prisma
model WotScore {
  followersCount  Int
  followingCount  Int
  wotDepth        Int
  trustScore      Float
  isLikelyBot     Boolean
  accountAgeScore Float
  activityScore   Float
  discountPercent Int
  lastCalculated  DateTime
}
```

**Why it shouldn't be in PostgreSQL**:
- Derived from kind 3 (contacts) events in relay
- Stale data problem (needs constant recalculation)
- Duplicates source of truth (relay has the actual follows)
- Can be computed on-demand from relay queries

**Solution**: Compute WoT scores dynamically from relay

```typescript
// Instead of: await prisma.wotScore.findUnique(...)
// Do: await computeWotScore(pubkey, relayPool)

async function computeWotScore(pubkey: string) {
  // Query relay for kind 3 events
  const followers = await queryEventsCached([{ kinds: [3], '#p': [pubkey] }]);
  const following = await queryEventsCached([{ kinds: [3], authors: [pubkey] }]);
  
  return {
    followersCount: followers.length,
    followingCount: following[0]?.tags.filter(t => t[0] === 'p').length || 0,
    wotDepth: calculateWotDepth(pubkey, followers),
    trustScore: calculateTrustScore(followers, following),
    // ... compute all metrics from relay data
  };
}
```

**Benefits**:
- Always fresh (no stale cache)
- Single source of truth (relay)
- Scales with relay performance
- Can use cached queries (already built)

---

## Migration Plan: Remove WotScore Table

### Step 1: Create WoT Service (Query-Based)

```typescript
// src/wot/wot-calculator.service.ts
@Injectable()
export class WotCalculatorService {
  async calculateWotScore(pubkey: string): Promise<WotScoreData> {
    // Query relay for contacts
    const [followers, following, profile] = await Promise.all([
      this.queryFollowers(pubkey),
      this.queryFollowing(pubkey),
      this.queryProfile(pubkey),
    ]);
    
    return {
      followersCount: followers.length,
      followingCount: following.length,
      wotDepth: this.calculateDepth(pubkey),
      trustScore: this.calculateTrust(followers, following),
      isLikelyBot: this.detectBot(profile, followers, following),
      accountAgeScore: this.scoreAge(profile),
      activityScore: await this.scoreActivity(pubkey),
    };
  }
}
```

### Step 2: Update WotService to Use Calculator

```typescript
// Replace database reads with relay queries
async getWotScore(pubkey: string) {
  return this.wotCalculator.calculateWotScore(pubkey);
}
```

### Step 3: Add Caching Layer

```typescript
// Cache computed scores for 5 minutes
@Cacheable('wot-scores', 300)
async getWotScore(pubkey: string) {
  return this.wotCalculator.calculateWotScore(pubkey);
}
```

### Step 4: Remove Prisma Model

```prisma
// Delete from schema.prisma:
// model WotScore { ... }
```

### Step 5: Drop Database Table

```sql
DROP TABLE IF EXISTS "WotScore";
```

---

## Summary

### PostgreSQL Should Only Contain:

| Table | Purpose | Stays? |
|-------|---------|--------|
| User | Internal ID mapping | ✅ |
| Session | Auth JWT state | ✅ |
| AuthChallenge | Auth challenges | ✅ |
| LnurlSession | LNURL state | ✅ |
| ApiKey | API key management | ✅ |
| ApiKeyUsage | Rate limiting | ✅ |
| Nip05 | Our product | ✅ |
| Domain | Domain management | ✅ |
| Subscription | Billing tiers | ✅ |
| Payment | Payment records | ✅ |
| AuditLog | Admin audit trail | ✅ |
| **WotScore** | **Derived from relay** | ❌ **REMOVE** |

### Benefits of Removing WotScore:

1. ✅ **Single source of truth** - Relay has the actual Nostr data
2. ✅ **Always fresh** - No stale cache issues
3. ✅ **Simpler** - One less table to maintain/migrate
4. ✅ **Faster** - Relay queries with caching are fast
5. ✅ **Scalable** - Relay handles indexing/filtering

---

## Next Steps

1. [ ] Implement `WotCalculatorService` (query-based)
2. [ ] Add 5-minute cache layer
3. [ ] Update `WotService` to use calculator
4. [ ] Test with existing WoT endpoints
5. [ ] Remove `WotScore` from Prisma schema
6. [ ] Create migration to drop table
7. [ ] Deploy

**Estimated effort**: 2-3 hours  
**Risk**: Low (WoT is only used for analytics/discounts, not critical path)

---

## Architecture Decision

**Adopted Principle**: 
> Nostr Relay = Nostr Database  
> PostgreSQL = Only Non-Nostr Supplemental Data

This audit confirms our architecture is **95% correct**. Only `WotScore` needs to be removed.

All other tables are appropriate for PostgreSQL because they contain business logic, payment state, or internal service data that can't/shouldn't be stored as Nostr events.
