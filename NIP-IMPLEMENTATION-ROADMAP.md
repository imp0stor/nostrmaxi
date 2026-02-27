# NostrMaxi NIP Implementation Roadmap

_Last updated: 2026-02-26_

## Objective
Expand NostrMaxi from managed NIP-05 identity tooling into a high-value social client + identity hub with strong protocol coverage, prioritizing:

1. **Identity trust + profile richness** (NIP-39 + stronger NIP-05 UX)
2. **Monetization and social proof** (NIP-57 zaps, NIP-58 badges)
3. **Content depth and engagement** (NIP-23 and additional high-adoption NIPs)

---

## Current Baseline (from codebase)

- ✅ Strong support for **NIP-05 managed identities** (provisioning, verification, external detection, domain verification flow)
- ✅ NIP-07/NIP-98 auth integration patterns already present
- ✅ Basic profile rendering from kind:0 metadata
- ⚠️ No explicit first-class implementation yet for NIP-39, NIP-57, NIP-58, NIP-23

---

## Priority Matrix (What to Build Next)

| NIP | Enables | Complexity | Dependencies | User Value | Priority |
|---|---|---:|---|---:|---:|
| **NIP-39** External Identities | Verifiable off-Nostr identity links (GitHub/X/etc.) in profile | Medium | kind:0 read/write, proof validators, profile UI cards | Very High | **P0** |
| **NIP-05 Enhancements** | Better identity reliability and trust UX | Low-Med | Existing NIP-05 stack | High | **P0** |
| **NIP-57** Lightning Zaps | Native value transfer + social signal | Med-High | LNURL/lud16, zap request/receipt parsing, wallet UX | Very High | **P0/P1** |
| **NIP-23** Long-form Content | Articles/blog posts and richer creator workflows | Medium | kind:30023 authoring, indexing, rendering | High | **P1** |
| **NIP-58** Badges | Reputation and community recognition | Medium | badge definitions/awards/profile display | Medium-High | **P1** |
| **NIP-25** Reactions | Like/emoji engagement mechanics | Low | reaction event parsing + UI | High | **P1** |
| **NIP-28** Public Chats | Community rooms and chat streams | Medium | channel event kinds + moderation controls | Medium | **P2** |
| **NIP-65** Relay List Metadata | Better relay routing and reliability | Low-Med | kind:10002 support | Medium | **P2** |
| **NIP-89** App Handlers | Better interoperability with clients/apps | Medium | capability discovery + launch routing | Medium | **P3** |

> Priority scoring combines user impact, monetization leverage, and implementation leverage over existing NostrMaxi infrastructure.

---

## NIP-39 Design: External Identity Widgets

NIP-39 introduces optional identity tags in metadata events for externally provable identities.

### Widget Goals

- Make identity trust **visible and actionable**
- Keep display modular by provider (GitHub, X/Twitter, Mastodon, Telegram, website, etc.)
- Distinguish:
  - **Verified** (cryptographic or deterministic proof available)
  - **Unverified link** (declared but not proven)
  - **Stale/failed** proof

### Profile Widget Set

#### 1) GitHub Identity Card

**Displays:**
- GitHub handle + verification status
- Public repo count
- Follower/following counts
- Top languages (if available)
- Link to recent activity/contributions page

**Proof path (NIP-39-oriented):**
- Parse identity proof reference from profile metadata
- Validate proof artifact contains expected npub statement
- Optional enhancement: cache validation result server-side with TTL

**Rich preview source:**
- GitHub public API (unauthenticated with low-rate fallback) + OpenGraph fallback

#### 2) X/Twitter Verification Card

**Displays:**
- Handle, profile link, optional avatar
- Verification badge state from proof validation (not from platform-paid badge)

**Proof path:**
- Validate referenced proof post contains canonical statement binding handle ↔ npub

**Rich preview source:**
- Link card fallback where API access is constrained

#### 3) Multi-Platform Identity Grid

**Platforms:**
- Mastodon, Telegram, Discord, personal website, GitHub, X, others from `i` tags

**Displays:**
- Provider icon + username
- Verification chip (Verified / Unverified / Failed)
- Last validation time

#### 4) External Link Preview Cards

If APIs unavailable, resolve OpenGraph metadata:
- title, description, favicon, hero image
- sanitize + cache to avoid SSRF/perf issues

### Data Model (proposed)

```ts
interface ExternalIdentityProof {
  platform: string;       // github | twitter | mastodon | telegram | website | ...
  identity: string;       // username, URL, or platform-specific identifier
  proof: string;          // reference to external proof content
  claim: string;          // canonical binding statement
  verified: boolean;
  verificationStatus: 'verified' | 'unverified' | 'failed' | 'stale';
  verifiedAt?: string;
  error?: string;
}
```

---

## Phased Plan

## Phase 1 (P0): Core Identity Layer
**Target: 1-2 agent days**

### Scope
- NIP-39 parser + verification pipeline (initial providers: GitHub + X + generic URL)
- Profile identity widget framework (cards + status chips)
- NIP-05 trust panel enhancements

### Deliverables
- External identities hooks/services (frontend + optional backend proxy)
- Profile UI module: `ExternalIdentityPanel`
- Verification cache (in-memory or DB-backed)
- Docs: supported identity providers + proof troubleshooting

### NIP-05 Enhancements included
- Better external NIP-05 vs managed NIP-05 distinction in profile UX
- Verification freshness timestamp and failure reason visibility
- More robust normalization of root-domain (`_@domain`) and alias formats

---

## Phase 2 (P1): Content + Reputation Expansion
**Target: 2-3 agent days**

### NIP-23 Long-form
- Draft/publish long-form notes (kind:30023)
- Reader view with markdown rendering
- Author profile section for articles

### NIP-58 Badges
- Badge definition + award ingestion
- Badge display shelf on profile
- Optional filtering by source/issuer trust

### NIP-25 Reactions
- Reaction counts and viewer reaction state
- Lightweight interaction parity with major clients

---

## Phase 3 (P2/P3): Advanced Social Interop
**Target: 3-5 agent days**

### NIP-57 Zaps (if not fully shipped in P1)
- Zap request + receipt handling
- Zap totals in feed/profile
- Wallet deep-linking and fallback UX

### NIP-28 Communities/Channels
- Public chat/channel discovery and participation
- Basic moderation controls

### NIP-65 Relay Smartness
- Import/apply user relay list metadata for fetch/publish optimization

### NIP-89 App Discovery
- Handler registration/consumption for deeper ecosystem integration

---

## Priority-Ordered Backlog with Effort Estimates

## P0 Backlog

1. **NIP-39 parsing + typed model** — _1 SP (~0.5 day)_
2. **NIP-39 proof validator service (GitHub/X/generic URL)** — _3 SP (~1 day)_
3. **ExternalIdentityPanel UI (cards + statuses)** — _2 SP (~0.5-1 day)_
4. **NIP-05 verification freshness + error states in profile** — _1 SP (~0.5 day)_
5. **Background verification cache + TTL policy** — _2 SP (~0.5-1 day)_

## P1 Backlog

6. **NIP-23 article composer + renderer** — _5 SP (~1.5-2 days)_
7. **NIP-58 badge ingestion + profile shelf** — _3 SP (~1 day)_
8. **NIP-25 reactions support** — _2 SP (~0.5-1 day)_

## P2/P3 Backlog

9. **NIP-57 zap event ingest + UI totals** — _5 SP (~1.5-2 days)_
10. **NIP-28 channel/community MVP** — _5 SP (~2 days)_
11. **NIP-65 relay list support** — _2 SP (~0.5 day)_
12. **NIP-89 app handlers** — _3 SP (~1 day)_

---

## Implementation Notes / Dependencies

- **Security:** any server-side URL fetching for previews/proofs must include SSRF protections, strict allowlists/timeouts, and content-length caps.
- **Reliability:** verification should be eventually consistent and cache-backed (avoid blocking profile rendering).
- **UX rule:** never hard-fail profile load because a provider API is down; degrade to unverified link state.
- **Protocol posture:** keep implementation permissive and metadata-driven; avoid overfitting to a single client’s interpretation.

---

## Definition of Done (Phase 1)

- User can view external identity cards in profile
- NIP-39 claims parsed from profile metadata and rendered
- At least GitHub + X proof flows produce explicit verification states
- NIP-05 area clearly communicates managed vs external identity trust
- Docs updated (`docs/SUPPORTED-NIPS.md`) with status and caveats
