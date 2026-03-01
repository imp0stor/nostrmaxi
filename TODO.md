# NostrMaxi TODO List

## Status: Active Development
**Last Updated:** 2026-03-01 11:30 EST

---

## 🔴 Critical (Must Fix Now)

### Auth & Access
- [x] Analytics access - FIXED (2026-03-01)
  - Fixed tier normalization in frontend (useAuth.ts)
  - Fixed `subscription.isActive` for non-expiring paid tiers
  - Added JWT recovery layer in auth middleware
  - **Needs:** User to logout/login for fresh JWT to verify

### Notifications
- [x] Notifications page auth - FIXED (2026-03-01)
  - Added auth guard recovery layer
  - JWT identity normalization handles hex pubkey in `sub` claim
  - Regression tests added

### Messages/DMs
- [x] DM support for all 3 types - IMPLEMENTED (2026-03-01)
  - NIP-04 (kind:4) - legacy encrypted ✅
  - NIP-44 (kind:14 wrapped in kind:1059) - new encrypted ✅
  - Unencrypted fallback ✅
- [x] DM reading works
- [x] DM composing works with default to NIP-44
- [x] Encryption indicator badges (🔒 NIP-44 | 🔐 NIP-04 | ⚠️ Unencrypted)

---

## 🟠 High Priority (User Experience)

### Connections Page
- [x] Retry logic for loadFollowing (3 retries, exponential backoff)
- [x] Retry logic for loadFollowers  
- [x] Exclude mutuals from Following/Followers columns
- [x] Simplify to single Mute button (remove Block)
- [ ] Global search filter across all lists
- [ ] Verify all lists load reliably

### Feed & Content
- [x] Composer UX - minimal Primal-style
- [x] Quoted notes display
- [ ] Media attachments work properly
- [ ] Link previews render

### Nostr Primitives Integration - IMPLEMENTED (2026-03-01)
- [x] **nostr-profile**: Profile verification chip, validation hints on ProfilePage
- [x] **nostr-engagement**: Engagement API (`/api/v1/primitives/engagement/profile/:pubkey`), metrics on profile
- [x] **nostr-wot-voting**: WoT score on profiles, trust filter toggle on FeedPage
- [x] **nostr-kb**: KB API endpoints wired
- [x] **nostr-relay-tooling**: Relay health tab in Settings, sync status display

---

## 🟡 Medium Priority (Polish)

### Visual/UX
- [x] TRUE BLACK theme
- [x] Premium icons (29 assets)
- [x] Micro-animations
- [x] All sidebar icons
- [ ] Empty states with illustrations
- [ ] Loading skeletons everywhere

### Admin
- [x] Database-driven roles
- [x] User management API
- [ ] Admin dashboard functional testing
- [ ] Runtime user tier updates

---

## 🟣 NIP-05 Marketplace - FOUNDATION COMPLETE (2026-03-01)

### Payment & Registration
- [x] Reserved names restricted (availability API checks)
- [x] Premium pricing tiers (name-pricing.ts)
- [ ] Verify payment flow works end-to-end

### Auction System - BACKEND COMPLETE
- [x] Database schema: `Nip05Auction`, `Nip05Bid`, `Nip05Transfer` models
- [x] API endpoints: `/api/v1/nip05/marketplace/auctions/*`
- [x] Bidding with min increment enforcement
- [x] Auction finalization endpoint
- [x] Frontend: Auction cards, bid history, time remaining
- [ ] Outbid notifications (push)
- [ ] Scheduled auction end job

### Flat Price Marketplace - BACKEND COMPLETE
- [x] API: `/api/v1/nip05/marketplace/listings`
- [x] Browse/filter premium names (MarketplacePage tabs)
- [x] Direct purchase flow endpoint
- [ ] Actual payment integration

### User Resale Marketplace - BACKEND COMPLETE  
- [x] Listing creation for owned NIP-05s
- [x] Lease remainder vs lifetime sale mode
- [x] Transfer initiation with escrow records
- [x] 5% platform fee calculation
- [ ] Actual escrow funds handling

### Database Schema
- [ ] Auctions table
- [ ] Listings table  
- [ ] Bids table
- [ ] Transfers table
- [ ] Reserved names table

---

## 🟢 Backlog

- [ ] Code splitting (bundle is 1.4MB)
- [ ] Frontend test script
- [ ] Performance for large follow lists
- [ ] Better error states
- [ ] Relay sync health display

---

## ✅ Completed

- [x] Ecosystem catalog redesign
- [x] Registration + entitlement gating
- [x] Feed card declutter
- [x] WoT fixes
- [x] User registration (imp0stor as LIFETIME + Admin)
- [x] Auth hardening (JWT identity normalization)
- [x] TRUE BLACK theme
- [x] Premium visual assets
- [x] Micro-animations
- [x] DM encryption support (backend)
- [x] Connection actions
- [x] Composer UX
- [x] Quoted notes fix
- [x] Sidebar icons
- [x] Mute/Block simplification
- [x] Connections retry logic

---

## Testing Credentials

**Test User (Adam/imp0stor):**
- pubkey: `9fdd0d57238ba01f8c04199ca3c0174fa17c19d28e9de610b9db22729e57310e`
- npub: `npub1nlws64er3wsplrqyrxw28sqhf7shcxwj36w7vy9emv3898jhxy8qspcpd0`
- tier: LIFETIME
- isAdmin: true

---

## Production Info

- Server: `neo@10.1.10.143`
- Repo: `/home/neo/nostrmaxi-production`
- Branch: `feat/dm-zap-ux`
- Tests: 65 suites, 270 tests
