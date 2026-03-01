# NostrMaxi Product Vision

## Problem Statement

**Problem:** Nostr users struggle with fragmented identity and lack of creator tools.

**Who has it?**
- Creators wanting professional Nostr presence
- Developers building Nostr apps needing NIP-05 services
- Users wanting verified identity + custom domains
- Podcasters/authors needing Nostr-native publishing tools

**Why it matters:**
- NIP-05 verification increases trust + discoverability
- Centralized platforms lock in content + identity
- Nostr primitives exist but scattered/hard to use
- Creators need monetization without platform rent-seeking

## Solution

**NostrMaxi = Identity + Creator Platform**

**Core offering:**
1. **NIP-05 Identity Registration** - Sell `name@nostrmaxi.com`, `name@strangesignal.ai`, custom domains
2. **NIP-05 Marketplace** - Auctions, flat-price sales, resale with Lightning split payments ✅ SHIPPED
3. **Creator Tools** - Feed generation, profile management, domain/site hosting
4. **Encrypted Messaging** - NIP-04/NIP-44 DMs with encryption badges ✅ SHIPPED
5. **Content Primitives** - Book authorship, gift cards, e-commerce (NIP-15)
6. **Community Features** - Q&A, bounties, reviews (WoT-filtered)
7. **Admin Infrastructure** - Runtime management, marketplace admin, transaction tracking ✅ SHIPPED

**How it solves the problem:**
- One-stop shop for Nostr superpowers
- Progressive feature rollout (buy identity now, add tools later)
- Nostr-native (no lock-in, sovereign data)
- Monetization-friendly (creators keep revenue, we charge SaaS fees)

## Target Users

### Primary: Creators
- **Podcasters** (using NostrCast for content, NostrMaxi for identity)
- **Authors** (publish books on Nostr)
- **Developers** (verified identity for projects)
- **Merchants** (sell products via NIP-15)

### Secondary: Consumers
- **Nostr users** (buy NIP-05 identity)
- **Readers/listeners** (discover content via feeds)
- **Shoppers** (buy from Nostr-native stores)

### Tertiary: Enterprises
- **Companies** needing team identities
- **Open source projects** needing verified presence
- **Communities** needing custom domains

## Success Criteria

### Revenue (Primary)
- **Month 1:** $50-500 MRR (5-50 NIP-05 sales)
- **Month 3:** $1K-5K MRR (100-500 users)
- **Month 6:** $10K+ MRR (1K+ users, enterprise tier)
- **Year 1:** $50K+ MRR (self-sustaining)

### Engagement
- **MAU:** 500+ by Month 3
- **Retention:** 70%+ 30-day (identity is sticky)
- **NPS:** 50+ (creator-focused = high satisfaction)

### Product
- **Phase 0 (MVP):** NIP-05 + roadmap (DONE)
- **Phase 1:** Feeds + profiles + domains (Week 4)
- **Phase 2:** Books + gift cards + shopping (Week 8)
- **Phase 3:** Q&A + bounties + reviews (Week 12)
- **Phase 4:** Fundraising + marketplace (Week 16)

## Constraints

### Technical
- **Nostr relay availability** - Must handle relay downtime gracefully
- **BTCPay dependency** - Payment flow depends on external service
- **Blossom maturity** - File hosting primitive still evolving
- **NIP adoption** - Some features depend on NIP standardization (book authorship, gift cards)

### Business
- **Time to revenue:** MVP must ship fast (< 1 week)
- **Bootstrap budget:** $200/mo Anthropic + $200/mo OpenAI (agent costs)
- **Support capacity:** Solo founder (automation-first support)
- **Competition:** Nostr.build, Nostrcheck, others offering NIP-05

### Operational
- **Hosting costs:** Must scale without breaking budget
- **Rate limits:** Nostr relay courtesy (don't spam)
- **Legal:** Identity services = compliance considerations (KYC?)

## Out of Scope

### Phase 0 (MVP)
- ❌ Podcast publishing (that's NostrCast)
- ❌ Video hosting (too expensive)
- ❌ Social features (following/DMs - use clients)
- ❌ Mobile apps (web-first)
- ❌ Custom relay hosting (recommend others)
- ❌ Lightning node management (use custodial)

### Phase 1-4
- ❌ Real-time collaboration (complex)
- ❌ AI-generated content (Phase 5+)
- ❌ NFT integration (not core value prop)
- ❌ Gaming primitives (handled by Immortals)

### Future Considerations
- Affiliate programs (Phase 5+)
- White-label for enterprises (Phase 5+)
- Open source tier (after revenue stable)

## Competitive Advantage

**Why NostrMaxi vs alternatives?**

1. **Integrated primitives** - Identity + tools, not just one thing
2. **Phased rollout** - Ship fast, add features incrementally
3. **Creator-first** - Built for people making things, not just consumers
4. **Sovereignty** - Nostr-native = no lock-in
5. **Economics** - Flat subscription > transaction fees (predictable costs)

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Nostr adoption stalls | Medium | High | Build value regardless (identity useful outside Nostr) |
| Competition undercuts pricing | Medium | Medium | Add features competitors don't have |
| Technical primitives immature (Blossom, NIPs) | High | Medium | Ship with what works now, iterate |
| Relay downtime breaks features | Medium | Medium | Multi-relay strategy, graceful degradation |
| Solo founder burnout | Medium | High | Automate ruthlessly, delegate to agents |

---

**Next:** Break this vision into epics in `epic-breakdown.md`
