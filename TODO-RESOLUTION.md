# TODO Resolution - NostrMaxi

**Scan Date:** 2026-02-11
**Scanned Files:** *.ts, *.js, *.md, *.py (excluding node_modules/dist)

## TODOs Found

### 1. `src/wot/wot.service.ts` (line ~113)

**Original TODO:**
```typescript
// TODO: In production, query relays for:
// 1. Follower count (kind 3 events mentioning this pubkey)
// 2. Following count (kind 3 event from this pubkey)
// 3. WoT depth (hops to trust anchors)
// 4. Account activity (recent events)
// 5. Bot detection signals
```

**Status:** ⏸️ DEFERRED

**Resolution Notes:**
This is a **feature implementation TODO**, not a bug or missing basic functionality. The current code uses mock/placeholder data for WoT scoring.

**What's Needed:**
1. Integrate with Nostr relay pool (e.g., using nostr-tools `SimplePool`)
2. Query kind:3 (follow list) events from multiple relays
3. Build graph traversal to calculate WoT depth from trust anchors
4. Implement activity scoring based on recent events
5. Add heuristics for bot detection (follow ratio, posting patterns, etc.)

**Complexity:** HIGH - Requires:
- Relay connection management
- Event caching (follow lists can be large)
- Graph algorithms for WoT depth calculation
- Rate limiting for relay queries

**Recommendation:** Create a dedicated ticket/issue for this feature with:
- Phase 1: Basic relay integration for follow counts
- Phase 2: WoT depth calculation with caching
- Phase 3: Activity scoring and bot detection

---

## Summary

| File | TODO | Status | Notes |
|------|------|--------|-------|
| wot.service.ts | Production relay queries | DEFERRED | Feature work, not a bug |

**Total TODOs:** 1
**Fixed:** 0
**Deferred:** 1
**Won't Fix:** 0
