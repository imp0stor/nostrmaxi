# Reserved Names & Pricing System

This document defines the NostrMaxi reserved-name namespace policy and pricing model.

## Goals

1. Protect users from impersonation and fraud.
2. Preserve scarce, high-value namespace inventory.
3. Create a fair marketplace for premium names.
4. Keep normal 5+ character names accessible.

## Name Tiers

### 1) Base Tier (5+ chars)
- Default registration path
- **Base price:** 21,000 sats
- First-come first-served (subject to availability)

### 2) Short Names (3-4 chars)
- Premium scarcity pricing
- **4 chars:** 210,000 sats
- **3 chars:** 2,100,000 sats

### 3) Ultra-short (1-2 chars)
- Ultra-premium inventory
- **2 chars:** 21,000,000 sats (auction-focused)
- **1 char:** 210,000,000 sats (auction-focused)
- Handled via marketplace auction flow

### 4) Reserved / Premium Curated Names
- Curated categories (stop words, public figures, brands, crypto/tech terms, common first names, high-value short terms)
- Some categories are fixed-price marketplace purchase
- Some categories are auction-only

## Reserved Categories

Implemented in `src/config/reserved-names.ts`:

- `blocked`: permanently unavailable (security/platform integrity)
- `stopWords`: common search terms; premium fixed-price marketplace
- `prominentNames`: high impersonation risk; auction-only
- `brands`: trademark-sensitive; auction-only / compliance review
- `techTerms`: premium fixed-price marketplace
- `cryptoTerms`: premium fixed-price marketplace
- `commonFirstNames`: premium fixed-price marketplace
- `highValueShort`: scarce/high-liquidity short terms; auction-only
- `singleCharacter`: all a-z + 0-9 (auction-only)
- `twoCharacter`: all 36x36 alphanumeric pairs (auction-only)

## Reserved Count

The current dataset includes **500+ reserved names** (well above minimum), including:
- Large stop-word corpus
- Prominent/cultural names
- Major global brands
- Crypto/Bitcoin ecosystem terms
- Common first names
- Full single-char set (36)
- Full two-char set (1296)

## Marketplace Model

### Fixed-price Reserved Inventory
- Names in fixed-price categories (`stopWords`, `commonFirstNames`, `techTerms`, `cryptoTerms`) have deterministic list prices.
- Can be purchased directly when available.

### Auction-only Inventory
- Names in auction categories (`singleCharacter`, `twoCharacter`, `prominentNames`, `brands`, `highValueShort`) require auction.
- Supports demand-based price discovery.

### Price Escalation
- Escalation is supported by:
  - category-level multipliers
  - scarcity (name length)
  - auction competition for high-demand names

## Registration Enforcement

The registration path now performs policy and pricing evaluation before provisioning:

- File: `src/config/name-pricing.ts`
- Function: `canDirectlyRegisterName(name)`

Behavior:
- Blocked names: rejected
- Reserved marketplace names: rejected from direct registration API (must use marketplace)
- Auction names (including 1-2 char): rejected from direct registration API
- Standard names: allowed with length-tier pricing quote attached

## Why this policy exists

- **Impersonation defense:** prominent names are high abuse targets.
- **Operational safety:** terms like `admin`, `support`, `security` are blocked.
- **Trademark risk reduction:** major brands are routed through controlled marketplace policy.
- **Economic fairness:** scarce namespace is priced by scarcity and demand, not only first-come speed.
- **User accessibility:** normal names remain inexpensive at base-tier pricing.

## Files

- `src/config/reserved-names.ts` — curated datasets + category metadata + multipliers
- `src/config/name-pricing.ts` — pricing + eligibility logic
- `src/nip05/nip05.service.ts` — registration enforcement integration
