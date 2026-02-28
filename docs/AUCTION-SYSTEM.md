# NostrMaxi Auction System (Zap-Native MVP)

## Overview

This auction system allows decentralized auction discovery on Nostr while keeping name ownership transfer centralized under NostrMaxi control.

- Auction listings are announced as Nostr events.
- Bids are submitted via Lightning zaps (kind `9735`).
- Bid amount is read from zap memo (`bid:<amount>`) when present, otherwise from zap amount.
- Winner is determined by highest valid bid after end time.
- If reserve is not met, auction fails.

## Event Kinds

- **Auction listing kind:** `30311` (parameterized replaceable style, 30xxx range)
- **Zap receipt kind:** `9735`

## Auction Listing Event Format

Kind `30311`, with content:

```json
{
  "name": "btc",
  "auctionPubkey": "<auction_pubkey>",
  "startingPriceSats": 100000,
  "reservePriceSats": 500000,
  "startsAt": 1700000000,
  "endsAt": 1700604800
}
```

Tags include:
- `d` = deterministic auction key (`<name>:<startsAt>:<endsAt>`)
- `name`
- `starting_price_sats`
- `reserve_price_sats`
- `starts_at`
- `ends_at`
- `auction_pubkey`

## Bidding via Zaps

Bidders zap the auction event.

Zap receipt (`9735`) parsing rules:
1. Must reference auction event id via `e` tag.
2. Bid amount:
   - Prefer memo `bid:<amount>` (or plain numeric memo).
   - Also accepts `npub1...:<amount>` and `bid:<amount>:npub1...`.
   - Fallback to zap amount tag (`amount` in millisats, converted to sats).
3. Bidder identity (required):
   - Prefer sender from `P` tag on zap receipt (or `sender_pubkey` tag if present).
   - Fallback to explicit memo npub.
   - Final fallback to event `pubkey` only when it is a valid hex pubkey.
   - If bidder cannot be identified, bid is rejected.

## Auction States

- `UPCOMING`: current time < `startsAt`
- `LIVE`: `startsAt` <= now <= `endsAt`
- `ENDED`: now > `endsAt`, not settled
- `SETTLED`: winner finalized and deed transfer executed/recorded

## Winner Determination

At settlement:
1. Take highest valid bid (tie-breaker: earliest timestamp).
2. Check reserve:
   - If highest bid < reserve -> auction ends without winner.
   - Else highest bidder wins.
3. Winner receives name deed token in centralized ownership system.

## MVP Policy Decisions

### Refunds
**No refunds (MVP).**
All zaps are final. Losing bidders are not refunded.

### Minimum Increment
A new bid must be at least **10% above** current highest bid.

### Anti-Sniping
If a valid bid arrives in the final **5 minutes**, extend auction by **10 minutes**.

## Reserved Names Integration

On auction creation, the system checks `src/config/reserved-names.ts`:

- If `auctionOnly = true`, auction creation is allowed.
- If not auction-only, creation is rejected and caller should use fixed-price marketplace flow.

This keeps scarce/high-risk names in auction flow while normal reserved names can remain fixed-price.

## API Endpoints

- `GET /api/v1/auctions` — list active auctions
- `GET /api/v1/auctions/:id` — details + bids
- `POST /api/v1/auctions` — create auction (admin only)
- `POST /api/v1/auctions/:id/settle` — settle ended auction (admin only)

## Example Flow

1. Admin creates auction for `btc@nostrmaxi.com`
   - start: 100k sats
   - reserve: 500k sats
2. Listing event is published (kind `30311`).
3. Users bid via zaps:
   - Alice 150k
   - Bob 300k
   - Alice 600k
4. Auction ends and settles:
   - Alice wins at 600k (reserve met)
5. Name deed assigned to winner by centralized name ownership system.
