# Sprint 001 Goals - NostrMaxi Launch Week

**Duration:** 2026-02-25 → 2026-03-03 (1 week)  
**Sprint Goal:** Ship MVP to production + Start Feed Generation (Epic 2)

---

## Sprint Objectives

1. **Launch NostrMaxi MVP publicly** (nostrmaxi.com live, accepting payments)
2. **Start Feed Generation Epic** (WoT-filtered feeds foundation)
3. **Gather first customer feedback** (5-10 paying users)

---

## Stories & Tasks

### Story 1: Production Launch (Epic 1 - Polish)

**As a user, I want to visit nostrmaxi.com and purchase a NIP-05 identity**

#### Tasks:
- [ ] **DNS Setup**
  - Configure nostrmaxi.com → 10.1.10.143:8086
  - Configure strangesignal.ai subdomain (if applicable)
  - Configure strange.news subdomain (if applicable)
  - Test DNS propagation
  - **Owner:** Main session
  - **Estimated:** 1h

- [ ] **TLS Certificate**
  - Configure Let's Encrypt via Caddy
  - Test HTTPS access
  - Verify auto-renewal works
  - **Owner:** Main session or sub-agent
  - **Estimated:** 1-2h

- [ ] **Fix CSS Import Warning**
  - Move `@import "../../../shared-ui/shared-ui.css"` before Tailwind
  - Rebuild frontend
  - Verify no build warnings
  - **Owner:** Quick fix (main session)
  - **Estimated:** 15min

- [ ] **Marketing Copy**
  - Write homepage copy (value prop, positioning)
  - Write pricing page copy (justify tiers)
  - Write FAQ (NIP-05, payments, privacy)
  - Add testimonials (if available)
  - **Owner:** Main session or copywriting sub-agent
  - **Estimated:** 2-3h

- [ ] **End-to-End Purchase Test**
  - Test full flow: Homepage → Pricing → Purchase → Payment → Verification
  - Test with Lightning invoice
  - Test with on-chain payment
  - Verify NIP-05 JSON served correctly
  - **Owner:** Manual (main session)
  - **Estimated:** 30min

- [ ] **Launch Announcement**
  - Post on Nostr (kind 1 event)
  - Post on Twitter/X (if applicable)
  - Post in relevant communities (Discord, Telegram, Reddit)
  - **Owner:** Main session
  - **Estimated:** 30min

**Acceptance Criteria:**
- [x] nostrmaxi.com live on HTTPS
- [x] Purchase flow working (Lightning + on-chain)
- [x] NIP-05 verification functional
- [x] No CSS/build warnings
- [x] 5-10 users registered (organic or announced)

**Priority:** P0 (MUST SHIP)

---

### Story 2: WoT Scoring Foundation (Epic 2)

**As a developer, I want WoT scoring infrastructure so feeds can filter by trust**

#### Tasks:
- [ ] **WoT Library Research**
  - Evaluate existing libs (nostr-wot, grapevine, etc.)
  - Decision: use lib vs build simple version
  - Document choice in `_bmad-output/architecture/wot-decision.md`
  - **Owner:** Sub-agent (research + doc)
  - **Estimated:** 2h

- [ ] **WoT Score Calculation**
  - Implement or integrate WoT algorithm
  - Calculate score for user's follows
  - Cache scores in DB (`wot_scores` table)
  - **Owner:** Sub-agent
  - **Estimated:** 4-6h

- [ ] **WoT API Endpoint**
  - `GET /api/v1/wot/score/:npub` - get WoT score for user
  - `GET /api/v1/wot/network` - get user's trust network
  - Test with real Nostr data
  - **Owner:** Sub-agent
  - **Estimated:** 2h

- [ ] **WoT Score Display**
  - Show WoT score on profiles (badge or indicator)
  - Show WoT score in search results (if applicable)
  - **Owner:** Sub-agent
  - **Estimated:** 1-2h

**Acceptance Criteria:**
- [ ] WoT scores calculated for user's follows
- [ ] Scores cached (refreshed every 24h)
- [ ] API endpoint returns scores
- [ ] UI displays scores (badge: High/Medium/Low trust)

**Priority:** P1 (needed for Epic 2 feeds)

---

### Story 3: Personal Feed Prototype (Epic 2)

**As a user, I want to see a feed of recent posts from people I trust**

#### Tasks:
- [ ] **Feed Service (Backend)**
  - Create `FeedService` class
  - Method: `generatePersonalFeed(userNpub, filterLevel)`
  - Query user's follows from Nostr relays
  - Filter by WoT score (if filterLevel = "wot")
  - Fetch recent events (kind 1) from trusted users
  - Return sorted by timestamp
  - **Owner:** Sub-agent
  - **Estimated:** 4-6h

- [ ] **Feed API Endpoint**
  - `GET /api/v1/feeds/personal` - get my personal feed
  - Query params: `filterLevel` (wot/genuine/firehose), `limit`, `since`
  - Return events with metadata (author, timestamp, WoT score)
  - **Owner:** Sub-agent
  - **Estimated:** 2h

- [ ] **Feed Viewer (Frontend)**
  - Create `FeedViewer` component
  - Display events as cards (author, content, timestamp)
  - Filter controls (WoT slider, content type toggles)
  - Infinite scroll or pagination
  - **Owner:** Sub-agent
  - **Estimated:** 4-6h

- [ ] **Feed Route**
  - Add route: `/feed` or `/dashboard/feed`
  - Wire up `FeedViewer` component
  - **Owner:** Sub-agent
  - **Estimated:** 30min

**Acceptance Criteria:**
- [ ] User can view personal feed (posts from follows)
- [ ] WoT filtering works (only trusted users shown when enabled)
- [ ] Feed updates (manual refresh or auto-refresh every 5min)
- [ ] At least 10 events displayed (if data available)

**Priority:** P1 (Epic 2 foundation)

---

### Story 4: First User Feedback Loop

**As the founder, I want to collect feedback from first 5-10 users**

#### Tasks:
- [ ] **Feedback Form**
  - Create `/feedback` page (simple form: name, email, feedback)
  - POST endpoint: `/api/v1/feedback`
  - Save to DB or email to founder
  - **Owner:** Quick build (main session or sub-agent)
  - **Estimated:** 1h

- [ ] **User Interviews**
  - Reach out to first 5 users
  - Ask: What do you love? What's broken? What's missing?
  - Document in `_bmad-output/user-feedback-sprint-001.md`
  - **Owner:** Main session (human interaction required)
  - **Estimated:** 2-3h

- [ ] **Feedback Analysis**
  - Review feedback
  - Identify top 3 requests
  - Prioritize for Sprint 002
  - **Owner:** Main session
  - **Estimated:** 1h

**Acceptance Criteria:**
- [ ] Feedback form live
- [ ] 5+ user responses collected
- [ ] Top 3 requests identified
- [ ] Sprint 002 priorities adjusted based on feedback

**Priority:** P2 (nice to have, but critical for product-market fit)

---

## Success Metrics

### Revenue
- **Target:** $50-300 (5-30 users @ $10 avg)
- **Measure:** BTCPay webhook logs, Stripe dashboard (if applicable)

### Engagement
- **Target:** 50+ site visits, 10+ signups, 5+ paying users
- **Measure:** Analytics (if available), manual DB query

### Product
- **Target:** 0 critical bugs, <5min page load, 99% uptime
- **Measure:** Error logs, Pingdom/uptime monitor

### Velocity
- **Target:** Sprint completed in 5-7 agent days
- **Measure:** Task completion timestamps

---

## Risks & Blockers

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DNS propagation slow (48h) | Medium | High | Start DNS early (Day 1 AM) |
| TLS cert fails | Low | High | Test manually, have fallback (HTTP redirect) |
| No users sign up | Medium | High | Announce widely, offer launch discount |
| WoT lib not available | Low | Medium | Build simple version (follow graph only) |
| Feed too slow (many relays) | Medium | Medium | Start with 1-2 fast relays, expand later |

---

## Daily Standup (Async)

**Format:** Write daily progress in `sprints/sprint-001-daily-log.md`

**Template:**
```
## Day X (YYYY-MM-DD)

**Completed:**
- [ ] Task 1
- [ ] Task 2

**In Progress:**
- [ ] Task 3

**Blocked:**
- [ ] Task 4 - Reason

**Next:**
- [ ] Task 5
```

---

## Notes

- **Parallel work:** Stories 2 & 3 (WoT + Feed) can be built by separate agents simultaneously
- **Story 1 is critical path:** Must ship before announcing
- **Story 4 can start immediately:** Feedback form doesn't block other work

---

**Next:** After sprint, write retrospective in `sprint-001-retrospective.md`
