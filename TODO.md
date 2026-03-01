# NostrMaxi TODO List

## Status: Active Development
**Last Updated:** 2026-03-01 10:15 EST

---

## 🔴 Critical (Blocking User Experience)

- [ ] Analytics access still showing LOCKED despite LIFETIME tier
  - User has tier=LIFETIME, isAdmin=true in DB
  - Need user to test fresh login
  - May be cached token issue

- [x] Auth "Invalid npub in auth token" errors
  - Fixed: hardened JWT identity normalization
  - Deployed: 2026-03-01

---

## 🟠 High Priority (User-Reported Issues)

- [x] Composer UX - Blossom upload box too prominent
  - Fixed: minimal Primal-style attachment
  - Commit: `57a936e`

- [x] Quoted notes not loading ("could not be loaded")
  - Fixed: normalize note1/nevent1 refs, handle q tags
  - Commit: `4674378`

- [x] Missing sidebar icons
  - Fixed: All 7 icons generated and wired up
  - Commit: `d4669db`

- [x] Simplify Mute/Block to single Mute button
  - Fixed: Removed Block (same as Mute on Nostr)
  - Commit: `d4669db`

- [ ] Followers list fails to load sometimes
  - Relay query unreliable for #p tag search
  - Subagent working on retry logic

- [ ] Some followers missing "Follow back" button
  - Should show for anyone not in Following list
  - Investigating

---

## 🟡 Medium Priority (Polish & UX)

- [x] TRUE BLACK theme - purge blue tints
  - Deployed

- [x] Premium visual assets (29 icons/illustrations)
  - Deployed

- [x] Micro-animations (zap flash, skeleton loading)
  - Deployed

- [x] DM encryption support (NIP-04/NIP-44)
  - Deployed

- [ ] Admin UI improvements
  - Database-driven roles (implemented, needs testing)
  - User management API (implemented)

- [ ] Tagline updated to "Nostrverse + identity"
  - Deployed

---

## 🟢 Low Priority (Nice to Have)

- [ ] Code splitting to reduce bundle size (1.4MB)
- [ ] Add proper test script to frontend package.json
- [ ] Performance optimization for large follow lists
- [ ] Better error states across all pages

---

## ✅ Completed (2026-03-01)

- [x] Ecosystem catalog redesign
- [x] Registration + entitlement gating
- [x] Feed card declutter
- [x] WoT fixes
- [x] User registration (imp0stor as LIFETIME + Admin)
- [x] Database-driven admin roles
- [x] Connection actions (follow/unfollow/mute/block)
- [x] Composer UX cleanup
- [x] Quoted notes fix
- [x] Auth hardening
- [x] TRUE BLACK theme
- [x] Premium visual assets
- [x] Micro-animations
- [x] DM encryption

---

## Testing Checklist

Before marking complete, verify:
- [ ] Fresh login works
- [ ] Analytics accessible for paid users
- [ ] Connection actions work (follow/unfollow/mute/block)
- [ ] Quoted notes render
- [ ] Composer is minimal
- [ ] All sidebar icons show
- [ ] No auth errors

---

## Notes

- Production: `neo@10.1.10.143:/home/neo/nostrmaxi-production`
- Branch: `feat/dm-zap-ux`
- Tests: 65 suites, 270 tests passing
