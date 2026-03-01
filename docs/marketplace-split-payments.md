# Marketplace Split Lightning Payments

## Overview

NIP-05 marketplace purchases now use a split settlement flow:

1. Buyer requests purchase (`buyListing` or `finalizeAuction`)
2. System creates a single Lightning invoice for **100%** of sale amount
3. Payment webhook confirms invoice
4. System splits funds at settlement time:
   - Platform fee: **5%** (500 bps)
   - Seller payout: **95%**
5. Seller payout is attempted immediately via LNURL-pay + LNbits outgoing payment
6. NIP-05 ownership transfer executes immediately after payout attempt
7. Listing/auction marked settled/sold

## Data Model

### `User.lightningAddress`
- nullable string
- required for seller listings/auction settlement
- accepted formats:
  - `name@domain.com`
  - `lnurl1...`

### `MarketplaceTransaction`
Tracks payment and split settlement details:
- source type/id (`listing` or `auction`)
- buyer + seller pubkeys
- total amount + computed split
- provider invoice/payment ids
- payout status/id
- final transfer id and timestamps

## API additions

### Seller settings
- `PATCH /api/v1/nip05/marketplace/seller/lightning-address`
- body: `{ "lightningAddress": "seller@domain.com" }`

### Admin operations
- `GET /api/v1/nip05/marketplace/admin/transactions?limit=100`
- `POST /api/v1/nip05/marketplace/admin/transactions/:transactionId/retry-payout`

## Webhook behavior + idempotency

Marketplace payment confirmations are handled inside the existing `/api/v1/payments/webhook` path:
- If a standard subscription `Payment` is not found, system attempts marketplace webhook handling.
- Duplicate webhook deliveries are safe:
  - settled transactions return idempotent success
  - pending -> paid transition guarded by status update check

## Provider expectations

- Invoice creation: existing configured provider (BTCPay or LNbits)
- Seller payout: currently implemented via LNbits outgoing payment API
  - requires `LNBITS_URL` + `LNBITS_ADMIN_KEY` (or fallback `LNBITS_API_KEY`)

If payout credentials are missing, settlement fails fast with explicit configuration error.
