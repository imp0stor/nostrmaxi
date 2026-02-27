# NostrMaxi NIP Implementation Sprints

## Sprint Breakdown

### Sprint 1: Core Value - Zaps + External Identity (3-4 days)
**Priority:** P0 - High user value + monetization
**Goal:** Enable tipping and richer profile trust signals

#### Sprint 1a: NIP-57 Lightning Zaps
- [ ] Zap request parsing + validation
- [ ] Zap receipt ingestion
- [ ] Zap totals display (profile + posts)
- [ ] Zap send UX (wallet integration)
- [ ] Tests + deployment

#### Sprint 1b: NIP-39 External Identities
- [ ] Parser for GitHub/Twitter/other platform links
- [ ] Proof validation (GitHub first, others scaffolded)
- [ ] Profile widget cards showing verified identities
- [ ] Tests + deployment

---

### Sprint 2: Content Richness (2-3 days)
**Priority:** P1 - Engagement and creator tools
**Goal:** Long-form content and social engagement

#### Sprint 2a: NIP-23 Long-form Content
- [ ] Article composer UI
- [ ] Markdown renderer
- [ ] Article feed/discovery
- [ ] Tests + deployment

#### Sprint 2b: NIP-25 Reactions
- [ ] Reaction event parsing
- [ ] Like/emoji UI on posts
- [ ] Reaction counts display
- [ ] Tests + deployment

---

### Sprint 3: Community + Recognition (2-3 days)
**Priority:** P1/P2 - Community features
**Goal:** Badges and community spaces

#### Sprint 3a: NIP-58 Badges
- [ ] Badge definition parsing
- [ ] Badge awards ingestion
- [ ] Profile badge shelf
- [ ] Tests + deployment

#### Sprint 3b: NIP-28 Public Channels (optional)
- [ ] Channel event support
- [ ] Channel list/discovery
- [ ] Basic participation UI
- [ ] Tests + deployment

---

### Sprint 4: Protocol Optimization (1-2 days)
**Priority:** P2 - Infrastructure improvements
**Goal:** Better relay routing and app interop

#### Sprint 4a: NIP-65 Relay Lists
- [ ] Relay list metadata parsing
- [ ] Smart relay selection
- [ ] Tests + deployment

#### Sprint 4b: NIP-89 App Handlers (optional)
- [ ] Handler registration
- [ ] App discovery
- [ ] Tests + deployment

---

## Execution Strategy

- **Parallel where possible:** Run multiple sub-sprints in parallel when no dependencies
- **Deploy incrementally:** Ship each completed feature immediately
- **Test-first:** Every NIP implementation must have tests
- **Reference existing:** Use proven patterns from other Nostr clients

## Current Status

- [x] NIP-05 (already implemented, enhanced)
- [x] NIP-39 scaffold (created in roadmap phase)
- [ ] All other NIPs - starting Sprint 1 now
