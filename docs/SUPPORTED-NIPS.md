# Supported NIPs (Planned + Current)

_Last updated: 2026-02-26_

This document tracks NIP support status in NostrMaxi.

## Status Key
- ✅ Implemented
- 🟡 Partial / In progress
- ⚪ Planned

---

## Core / Identity

### NIP-01: Basic protocol flow
- **Status:** 🟡
- **What it enables:** Standard event model/interoperability
- **Notes:** Core event handling exists via `nostr-tools`; full matrix support depends on feature modules.

### NIP-05: Mapping Nostr keys to DNS-based identifiers
- **Status:** ✅ (managed) + 🟡 (enhancements)
- **What it enables:** Human-readable identities (`name@domain`) and trust cues
- **Current implementation highlights:**
  - Managed identity provisioning
  - Well-known lookup endpoint
  - Domain verification workflow
  - External NIP-05 detection in profile
- **Planned enhancements:**
  - Better verification freshness/diagnostics in UX
  - Continued parser hardening + edge-case handling

### NIP-07: Browser extension signer API
- **Status:** ✅
- **What it enables:** Browser-based signer integration (Alby/nos2x/etc.)

### NIP-19: bech32 entities (`npub`, etc.)
- **Status:** ✅
- **What it enables:** User-friendly encoding/decoding for keys and entities

### NIP-39: External identities in profile metadata
- **Status:** ⚪ Planned (P0)
- **What it enables:** Verifiable links to external identities (GitHub, X, etc.)
- **Planned scope:**
  - Parse identity proofs from metadata
  - Verification status model and profile widgets
  - Initial provider support: GitHub, X, generic URL proof

---

## Auth / API

### NIP-98: HTTP Auth
- **Status:** ✅
- **What it enables:** Signed Nostr events for API request auth

---

## Social / Content / Reputation

### NIP-23: Long-form content
- **Status:** ⚪ Planned (P1)
- **What it enables:** Article/blog style publishing (kind:30023)

### NIP-25: Reactions
- **Status:** ⚪ Planned (P1)
- **What it enables:** Emoji/like interaction primitives

### NIP-57: Lightning zaps
- **Status:** ⚪ Planned (P0/P1)
- **What it enables:** Native tipping + social value signal

### NIP-58: Badges
- **Status:** ⚪ Planned (P1)
- **What it enables:** Achievements/reputation via badge definitions + awards

### NIP-28: Public chat channels/communities
- **Status:** ⚪ Planned (P2)
- **What it enables:** Group/community experiences

---

## Relay / Interop

### NIP-65: Relay list metadata
- **Status:** ⚪ Planned (P2)
- **What it enables:** Better relay read/write routing and reliability

### NIP-89: App handlers
- **Status:** ⚪ Planned (P3)
- **What it enables:** Application capability discovery/interoperability

---

## Priority Summary

1. **P0:** NIP-39 + NIP-05 enhancements (+ zap foundation)
2. **P1:** NIP-23, NIP-58, NIP-25
3. **P2/P3:** NIP-57 completion, NIP-28, NIP-65, NIP-89

## UX Integration Principle (Design)
- Protocol support should be **feature-rich but intuitively simple**.
- Base feed stays clean; advanced NIP controls/details appear via progressive disclosure (popover/modal/drawer).
- Any contributor-backed data exposed by a NIP feature (e.g., zaps/reactions/reposts/relay metadata) must be drillable.

For full sequencing, effort, and dependencies, see:
- `../NIP-IMPLEMENTATION-ROADMAP.md`
- `../DESIGN-GAP-REVIEW-AND-NEXT-INSPIRATION-2026-03-01.md`
