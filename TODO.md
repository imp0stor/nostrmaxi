# NostrMaxi TODO List

## Status: Active Development
**Last Updated:** 2026-03-01 11:10 EST

---

## 🔴 Critical (Must Fix Now)

### Auth & Access
- [ ] Analytics access - LOCKED despite LIFETIME tier
  - User: pubkey `9fdd0d57238ba01f8c04199ca3c0174fa17c19d28e9de610b9db22729e57310e`
  - DB has: tier=LIFETIME, isAdmin=true
  - Frontend check: `hasPaidEntitlement` not recognizing tier
  - **Action:** Debug auth flow, ensure tier is in JWT/response

### Notifications
- [ ] Notifications page shows "Invalid npub in auth token"
  - Auth middleware still flaky
  - **Action:** Test with registered user, fix remaining auth issues

### Messages/DMs
- [ ] DM support for all 3 types:
  - NIP-04 (kind:4) - legacy encrypted
  - NIP-44 (kind:14 wrapped in kind:1059) - new encrypted
  - Unencrypted (if any)
- [ ] DM reading works
- [ ] DM composing works with default to NIP-44
- [ ] Encryption indicator on messages

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

### Nostr Primitives Integration
- [ ] **nostr-profile**: Enhanced profile display/caching
- [ ] **nostr-engagement**: Zap analytics, reaction counts
- [ ] **nostr-wot-voting**: Trust score visualization
- [ ] **nostr-kb**: Knowledge base articles display
- [ ] **nostr-relay-tooling**: Relay health monitoring

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
