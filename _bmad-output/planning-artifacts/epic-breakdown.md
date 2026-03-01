# NostrMaxi Epic Breakdown

Based on [product-vision.md](./product-vision.md)

---

## Epic 1: NIP-05 Identity (MVP) ✅ COMPLETE

**Goal:** Sell verified Nostr identities on multiple domains

**Status:** SHIPPED (Phase 0)

**User Stories:**
1. ✅ As a Nostr user, I want to register `name@nostrmaxi.com` so I'm verified
2. ✅ As a creator, I want to choose from multiple domains (nostrmaxi.com, strangesignal.ai, strange.news)
3. ✅ As a user, I want to bring my own domain (BYOD)
4. ✅ As a user, I want to pay with Bitcoin (Lightning/on-chain via BTCPay)
5. ✅ As a user, I want to see pricing tiers (Free/Creator/Studio)

**Technical Requirements:**
- ✅ Backend: NIP-05 provisioning API
- ✅ Frontend: Domain selector, pricing page, purchase flow
- ✅ Database: users, identities, subscriptions, payments tables
- ✅ Integration: BTCPay, Nostrcheck server

**Acceptance Criteria:**
- ✅ User can purchase NIP-05 identity
- ✅ Payment confirmed via BTCPay webhook
- ✅ NIP-05 JSON served at `/.well-known/nostr.json?name=<user>`
- ✅ DNS TXT verification for BYOD
- ✅ Pricing page shows all tiers

**Estimated Effort:** COMPLETE

**Dependencies:** None

**Risks:** None (shipped)

---

## Epic 2: Feed Generation (Phase 1)

**Goal:** Curated Nostr feeds with WoT filtering

**User Stories:**
1. As a user, I want to see a personalized feed from people I trust (WoT)
2. As a creator, I want to create custom feeds (trending, recent, quality)
3. As a user, I want 3-tier filtering (WoT/Genuine/Firehose)
4. As a developer, I want to subscribe to feeds via RSS

**Technical Requirements:**
- **Backend:**
  - Feed generation service (query WoT graph + recent events)
  - Feed template engine (trending, recent, quality algorithms)
  - RSS export endpoint
  - WebSocket feed streaming (optional)
- **Frontend:**
  - Feed viewer component
  - Filter controls (WoT slider, content types)
  - Feed subscription UI
- **Database:**
  - `feeds` table (user_id, name, filter_config)
  - `feed_subscriptions` table (user_id, feed_id)
  - `wot_scores` table (user_npub, score, last_updated)

**Acceptance Criteria:**
- [ ] User can create personal feed with WoT filtering
- [ ] Feed updates in real-time (or <5min polling)
- [ ] 3-tier filter working (WoT shows trusted, Genuine filters spam, Firehose shows all)
- [ ] Trending algorithm surfaces popular content (not just recent)
- [ ] RSS export works (feed_url.rss validates)
- [ ] Free users: 1 feed, Creator: 5 feeds, Studio: unlimited

**Estimated Effort:** 3-4 agent days (parallel with Epic 3)

**Dependencies:**
- WoT scoring service (integrate existing lib or build simple version)
- Nostr relay subscription (persistent WebSocket connections)

**Risks:**
- WoT scoring expensive (may need caching)
- Relay downtime breaks feeds (need multi-relay fallback)
- Real-time updates complex (may start with polling)

---

## Epic 3: Profile Management (Phase 1)

**Goal:** Rich Nostr profiles with professional features

**User Stories:**
1. As a creator, I want to edit my profile (bio, avatar, banner, links)
2. As a user, I want to display my NIP-05 identities prominently
3. As a creator, I want skill endorsements (LinkedIn-style)
4. As a user, I want to see someone's WoT score on their profile
5. As a creator, I want custom themes/layouts for my profile page

**Technical Requirements:**
- **Backend:**
  - Profile CRUD API (`/api/v1/profiles/:npub`)
  - Endorsement system (`POST /api/v1/profiles/endorse`)
  - Profile search API
  - Nostr event publishing (NIP-05, profile metadata)
- **Frontend:**
  - Profile editor component
  - Public profile viewer
  - Endorsement UI
  - Theme selector
- **Database:**
  - `profiles` table (npub, bio, avatar_url, banner_url, links, theme)
  - `endorsements` table (endorser_npub, endorsee_npub, skill, timestamp)

**Acceptance Criteria:**
- [ ] User can edit profile (bio, avatar, banner, social links)
- [ ] Profile displays all NIP-05 identities owned
- [ ] Endorsement works (user A endorses user B's "Podcast Editing" skill)
- [ ] WoT score displayed (badge/indicator on profile)
- [ ] Custom themes apply (dark/light/purple/custom CSS)
- [ ] Public profile URL shareable (nostrmaxi.com/profile/<npub>)

**Estimated Effort:** 3-4 agent days (parallel with Epic 2)

**Dependencies:**
- NIP-05 Epic complete (profile needs identities to display)
- WoT scoring (for score display)

**Risks:**
- Nostr event publishing failures (relay timeout/rejection)
- Theme customization XSS risk (need CSS sanitization)
- Endorsement spam (need rate limiting or WoT gating)

---

## Epic 4: Domain & Site Management (Phase 1)

**Goal:** Custom domains + Nostr-powered sites

**User Stories:**
1. As a creator, I want to point my custom domain to my NostrMaxi profile
2. As a user, I want to verify domain ownership (DNS TXT record)
3. As a creator, I want a custom Lightning address (pay@mydomain.com)
4. As a creator, I want to choose site templates (personal, portfolio, store)
5. As a user, I want analytics (views, zaps, engagement)

**Technical Requirements:**
- **Backend:**
  - Domain verification API (`POST /api/v1/domains/verify`)
  - DNS checker (query TXT records)
  - Lightning address proxy (LNURL)
  - Site template engine
  - Analytics tracking
- **Frontend:**
  - Domain setup wizard (DNS instructions, verification)
  - Template selector
  - Analytics dashboard
- **Database:**
  - `domains` table (user_id, domain, verified, tls_cert_path)
  - `sites` table (user_id, domain_id, template, config)
  - `analytics` table (site_id, event_type, timestamp, metadata)

**Acceptance Criteria:**
- [ ] User can add custom domain (name server instructions shown)
- [ ] DNS verification works (checks TXT record `nostrmaxi-verify=<token>`)
- [ ] Custom Lightning address functional (pay@domain.com → user's wallet)
- [ ] 3+ templates available (personal blog, portfolio, e-commerce)
- [ ] Analytics dashboard shows views, zaps, top content
- [ ] TLS cert auto-provisioned (Let's Encrypt)

**Estimated Effort:** 4-5 agent days

**Dependencies:**
- Profile Epic (site displays profile data)
- Infrastructure: TLS cert automation (Caddy/Traefik)

**Risks:**
- DNS propagation delays (48h in worst case)
- TLS cert failures (need fallback/retry logic)
- Analytics privacy concerns (GDPR compliance?)
- Lightning address proxy downtime

---

## Epic 5: Book Authorship (Phase 2)

**Goal:** Publish books on Nostr (NIP-XX)

**User Stories:**
1. As an author, I want to create a book (title, chapters, cover)
2. As an author, I want to write chapters in Markdown with preview
3. As an author, I want to publish books to Nostr (kind TBD, maybe NIP-23 extension)
4. As a reader, I want to download books (PDF/ePub)
5. As an author, I want to track sales/zaps per book

**Technical Requirements:**
- **Backend:**
  - Book CRUD API
  - Chapter management
  - Markdown → HTML/PDF/ePub conversion
  - Nostr event builder (long-form content)
  - Blossom upload (for files)
  - Sales tracking
- **Frontend:**
  - Book editor (Markdown with preview)
  - Chapter reordering (drag/drop)
  - Cover upload
  - Book viewer (reader experience)
- **Database:**
  - `books` table (author_npub, title, description, cover_url, status)
  - `chapters` table (book_id, order_index, title, content, published_at)
  - `book_sales` table (book_id, buyer_npub, amount_sats, timestamp)

**Acceptance Criteria:**
- [ ] Author can create book with multiple chapters
- [ ] Markdown editor works (live preview, formatting toolbar)
- [ ] Book published to Nostr (event includes TOC + chapter links)
- [ ] PDF/ePub export works (downloadable from Blossom)
- [ ] Sales tracking shows total zaps + buyer count
- [ ] Creator tier: 3 books, Studio tier: unlimited

**Estimated Effort:** 5-6 agent days

**Dependencies:**
- Blossom integration (for file hosting)
- Nostr NIP standardization (may need to pioneer new kind)
- Payment tracking (zap receipts)

**Risks:**
- NIP not standardized (may need custom kind)
- Blossom server reliability
- ePub generation complex (may need external lib)
- Copyright enforcement (can't prevent copying once published)

---

## Epic 6: Gift Cards (Phase 2)

**Goal:** Bitcoin gift cards via Nostr

**User Stories:**
1. As a user, I want to create a gift card (amount, design, message)
2. As a user, I want to redeem a gift card (Lightning/on-chain)
3. As a merchant, I want to sell gift cards in my store
4. As a user, I want to check gift card balance
5. As a creator, I want custom gift card designs (branding)

**Technical Requirements:**
- **Backend:**
  - Gift card creation API
  - Redemption API (Lightning invoice generation)
  - Balance checker
  - Nostr event publishing (gift card metadata)
- **Frontend:**
  - Gift card creator (amount, design picker, message)
  - Redemption flow (enter code → claim sats)
  - Balance checker
  - Marketplace (browse/buy gift cards)
- **Database:**
  - `gift_cards` table (code, creator_npub, amount_sats, design_url, message, redeemed, redeemed_by, redeemed_at)
  - `redemptions` table (gift_card_id, redeemer_npub, ln_invoice, paid_at)

**Acceptance Criteria:**
- [ ] User can create gift card (100K sats, holiday design, "Happy Birthday!")
- [ ] Gift card code unique + secure (UUID or cryptographic)
- [ ] Redemption works (user enters code → Lightning invoice → sats received)
- [ ] Balance checker shows remaining value
- [ ] Custom designs uploadable (Creator tier+)
- [ ] Platform fee: 2% per transaction

**Estimated Effort:** 3-4 agent days

**Dependencies:**
- Lightning infrastructure (BTCPay or direct LND integration)
- Nostr event publishing (gift card announcements)

**Risks:**
- Lightning liquidity issues
- Gift card fraud (need rate limiting)
- Redemption UX complex (educate users on Lightning)
- Platform fee might deter use (test pricing)

---

## Epic 7: Shopping & Stores (Phase 2)

**Goal:** Nostr-native e-commerce (NIP-15)

**User Stories:**
1. As a merchant, I want to create a store (name, description, logo)
2. As a merchant, I want to list products (title, price, images, inventory)
3. As a buyer, I want to browse stores + add to cart
4. As a buyer, I want to checkout with Lightning
5. As a merchant, I want to fulfill orders (shipping, tracking)
6. As a buyer/merchant, I want to leave/read reviews (WoT-filtered)

**Technical Requirements:**
- **Backend:**
  - Store CRUD API
  - Product management API
  - Shopping cart service
  - Checkout/payment flow (BTCPay)
  - Order fulfillment tracking
  - Review system (WoT-gated)
  - Nostr NIP-15 event publishing
- **Frontend:**
  - Store creator
  - Product lister
  - Shopping cart UI
  - Checkout flow
  - Order status tracker
  - Review submission/display
- **Database:**
  - `stores` table (owner_npub, name, description, logo_url)
  - `products` table (store_id, title, description, price_sats, images, inventory)
  - `orders` table (product_id, buyer_npub, amount_sats, status, shipping_info)
  - `reviews` table (product_id, reviewer_npub, rating, text, wot_score)

**Acceptance Criteria:**
- [ ] Merchant can create store + list products
- [ ] Product pages show images, description, price, reviews
- [ ] Shopping cart works (add/remove items)
- [ ] Checkout via Lightning (BTCPay integration)
- [ ] Order status updates (pending → paid → shipped → delivered)
- [ ] Reviews visible (WoT > threshold by default)
- [ ] Platform fee: 2% per sale

**Estimated Effort:** 6-7 agent days

**Dependencies:**
- NIP-15 standardization
- BTCPay integration
- WoT scoring (for review filtering)
- Shipping provider APIs (optional)

**Risks:**
- E-commerce is complex (returns, disputes, fraud)
- NIP-15 adoption low (chicken-egg problem)
- Platform fee might deter merchants (test pricing)
- Review spam (need WoT gating + moderation tools)

---

## Epic 8: Q&A Platform (Phase 3)

**Goal:** Stack Exchange for Nostr

**User Stories:**
1. As a user, I want to ask questions + get answers
2. As a user, I want to vote on answers (upvote/downvote)
3. As a creator, I want to offer bounties for answers (sats)
4. As a user, I want to earn reputation from helpful answers
5. As a user, I want to search questions by tag/keyword

**Technical Requirements:**
- **Backend:**
  - Question/answer CRUD API
  - Voting system (upvotes/downvotes)
  - Bounty system (lock sats, release to accepted answer)
  - Reputation calculation
  - Tag management
  - Search/filter API
- **Frontend:**
  - Question lister
  - Question detail page (with answers)
  - Answer submission form
  - Voting UI
  - Bounty creation flow
  - Tag browser
- **Database:**
  - `questions` table (author_npub, title, body, tags, bounty_sats, created_at)
  - `answers` table (question_id, author_npub, body, upvotes, downvotes, accepted)
  - `votes` table (user_npub, answer_id, vote_type)
  - `bounties` table (question_id, amount_sats, claimed_by, claimed_at)
  - `reputation` table (user_npub, score, last_updated)

**Acceptance Criteria:**
- [ ] User can post question with tags
- [ ] Answers sorted by votes (accepted answer pinned)
- [ ] Voting works (upvote = +10 rep, downvote = -2 rep)
- [ ] Bounty flow: creator locks sats → answerer claims → payout
- [ ] Reputation displayed on profiles
- [ ] Search works (questions by tag/keyword)

**Estimated Effort:** 5-6 agent days

**Dependencies:**
- Profile system (reputation displayed there)
- Lightning infrastructure (bounty payouts)

**Risks:**
- Spam questions/answers (need reputation gating or WoT filtering)
- Bounty disputes (what if no good answer?)
- Vote manipulation (sock puppets)
- Complex moderation needs

---

## Epic 10: NIP-05 Marketplace (Phase 1.5) ✅ COMPLETE

**Goal:** Secondary market for NIP-05 identities with Lightning payments

**Status:** SHIPPED (2026-03-01)

**User Stories:**
1. ✅ As an admin, I want to manage reserved/premium/blocked name lists
2. ✅ As an admin, I want to create auctions for premium names
3. ✅ As a user, I want to bid on auctioned names
4. ✅ As a user, I want to buy flat-price premium names
5. ✅ As a user, I want to resell my NIP-05 identity
6. ✅ As a seller, I want to receive 95% of sale price automatically

**Technical Implementation:**
- ✅ Admin panel: /admin/marketplace (names, auctions, listings, transfers)
- ✅ Split payments: 5% platform fee, 95% to seller via Lightning
- ✅ Immediate transfer on payment (no escrow complexity)
- ✅ MarketplaceTransaction audit trail
- ✅ Seller Lightning address management

**Acceptance Criteria:**
- ✅ Admin can CRUD reserved/premium/blocked names
- ✅ Admin can create/manage auctions
- ✅ Users can bid with min increment enforcement
- ✅ Users can buy flat-price listings
- ✅ Split payment executes on purchase
- ✅ NIP-05 transfers immediately

**Dependencies:** Lightning infrastructure, NIP-05 Epic

---

## Epic 11: Messaging & DMs (Phase 1.5) ✅ COMPLETE

**Goal:** Nostr-native encrypted messaging

**Status:** SHIPPED (2026-03-01)

**User Stories:**
1. ✅ As a user, I want to read DMs (NIP-04, NIP-44, gift-wrap)
2. ✅ As a user, I want to compose DMs with encryption selection
3. ✅ As a user, I want to see encryption badges on messages

**Technical Implementation:**
- ✅ NIP-04 (kind:4) legacy encrypted
- ✅ NIP-44 (kind:14 wrapped in kind:1059) modern encrypted
- ✅ Gift-wrap unwrapping
- ✅ Encryption badges (🔒 NIP-44 | 🔐 NIP-04 | ⚠️ Unencrypted)

---

## Epic 12: Admin Infrastructure (Phase 1.5) ✅ COMPLETE

**Goal:** Backend admin tools for platform management

**Status:** SHIPPED (2026-03-01)

**User Stories:**
1. ✅ As an admin, I want database-driven role management
2. ✅ As an admin, I want to manage user tiers at runtime
3. ✅ As an admin, I want marketplace management tools
4. ✅ As an admin, I want to view/retry payment transactions

**Technical Implementation:**
- ✅ Admin guards on protected routes
- ✅ User management API
- ✅ Marketplace admin panel
- ✅ Transaction history + retry-payout

---

## Epic 13: Nostr Primitives Integration (Phase 1.5) ✅ COMPLETE

**Goal:** Leverage @strangesignal primitives for enhanced features

**Status:** SHIPPED (2026-03-01)

**User Stories:**
1. ✅ As a user, I want to see engagement metrics on profiles
2. ✅ As a user, I want WoT trust filtering on feeds
3. ✅ As a user, I want relay health visibility in settings

**Technical Implementation:**
- ✅ nostr-engagement: profile engagement API
- ✅ nostr-wot-voting: trust score display, feed filter
- ✅ nostr-relay-tooling: relay health tab
- ✅ nostr-profile: verification chips

---

## Epic 9: Bug Bounties (Phase 3)

**Goal:** Incentivize bug reports + fixes

**User Stories:**
1. As a project owner, I want to create bug bounty (description, reward)
2. As a developer, I want to submit solution (PR link)
3. As a project owner, I want to review + accept solution
4. As a developer, I want to receive payout (Lightning)
5. As a user, I want to see leaderboard (top bug hunters)

**Technical Requirements:**
- **Backend:**
  - Bounty CRUD API
  - Submission review API
  - Payout system (Lightning)
  - Leaderboard calculation
- **Frontend:**
  - Bounty creator
  - Bounty lister
  - Submission form (PR link, description)
  - Review UI (approve/reject)
  - Leaderboard
- **Database:**
  - `bounties` table (project_npub, title, description, reward_sats, status)
  - `submissions` table (bounty_id, submitter_npub, pr_link, description, status)
  - `payouts` table (bounty_id, recipient_npub, amount_sats, paid_at)

**Acceptance Criteria:**
- [ ] Project owner can create bounty (title, description, reward)
- [ ] Developer can submit solution (GitHub PR link)
- [ ] Owner can approve/reject submission
- [ ] Payout automatic on approval (Lightning)
- [ ] Leaderboard shows top earners (all-time + monthly)

**Estimated Effort:** 3-4 agent days

**Dependencies:**
- Lightning infrastructure
- GitHub API (optional, for PR validation)

**Risks:**
- Payout disputes (owner doesn't pay)
- Low-quality submissions (need review process)
- Gaming leaderboard (sock puppets claiming bounties)

---

## Dependencies Summary

**Critical Path:**
1. Epic 1 (NIP-05) → Epic 2 (Feeds) + Epic 3 (Profiles) → Epic 4 (Domains)
2. Epic 4 (Domains) → Epic 5 (Books) or Epic 7 (Shopping)
3. Epic 5 (Books) needs Blossom integration
4. Epic 6 (Gift Cards) + Epic 7 (Shopping) need Lightning + BTCPay
5. Epic 8 (Q&A) + Epic 9 (Bounties) need Profiles + Lightning

**Parallel Execution:**
- Epic 2 + Epic 3 (can build simultaneously)
- Epic 5 + Epic 6 (independent)
- Epic 8 + Epic 9 (similar tech stack)

**External Dependencies:**
- **Blossom:** Server availability, API stability
- **Lightning:** BTCPay uptime, liquidity
- **Nostr NIPs:** Standardization of book/gift card/shopping kinds
- **WoT Scoring:** Mature library or build in-house

---

## Estimated Timeline (Agentic Time)

**Phase 1 (Weeks 2-4):** Epics 2-4 (Feeds + Profiles + Domains) = 10-13 agent days  
**Phase 2 (Weeks 5-8):** Epics 5-7 (Books + Gift Cards + Shopping) = 14-17 agent days  
**Phase 3 (Weeks 9-12):** Epics 8-9 (Q&A + Bounties) = 8-10 agent days  

**Total:** 32-40 agent days (~6-8 calendar weeks with 5+ parallel agents)

---

## Risk Mitigation Strategy

| Risk Category | Mitigation |
|---------------|-----------|
| **External Service Downtime** | Multi-provider fallback (Blossom → S3, relay clusters) |
| **NIP Standardization Delays** | Ship with custom kinds, adapt when NIPs ratified |
| **Lightning Liquidity Issues** | Partner with custodial wallet (Alby, Wallet of Satoshi) |
| **Spam/Abuse** | WoT gating on all user-generated content |
| **Solo Founder Burnout** | Agent swarms for parallel work, ruthless automation |

---

**Next:** Plan Sprint 001 in `sprints/sprint-001-goals.md`
