import { createHash } from 'crypto';

/**
 * Proposed Nostr event kinds for off-chain name deed operations.
 */
export const NAME_DEED_EVENT_KINDS = {
  deedIssued: 39770,
  deedTransferIntent: 39771,
  deedTransferred: 39772,
  deedListedForSale: 39773,
  deedSaleCompleted: 39774,
  deedRenewed: 39775,
} as const;

export interface NameDeedPayload {
  deedId: string;
  name: string;
  ownerPubkey: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  version: 'v1';
}

export interface SignedNameDeed {
  payload: NameDeedPayload;
  signature: string;
  signerPubkey: string;
  algorithm: 'schnorr-secp256k1';
}

export interface NameDeedTransferPayload {
  deedId: string;
  name: string;
  fromPubkey: string;
  toPubkey: string;
  transferAt: string;
  expiresAt: string;
  nonce: string;
  askPriceSats?: number;
  version: 'v1';
}

export interface CounterSignedTransfer {
  transfer: NameDeedTransferPayload;
  sellerSignature: string;
  buyerSignature: string;
  finalOwnerPubkey: string;
}

export interface NameDeedMarketplaceListing {
  listingId: string;
  deedId: string;
  name: string;
  sellerPubkey: string;
  askPriceSats: number;
  createdAt: string;
  expiresAt: string;
  status: 'open' | 'sold' | 'cancelled' | 'expired';
}

export interface NostrNameDeedEventTemplate {
  kind: number;
  content: string; // JSON.stringify(payload)
  tags: string[][];
  created_at: number;
  pubkey: string;
}

export function computeDeedId(name: string, ownerPubkey: string, issuedAtIso: string, nonce: string): string {
  const canonical = `${name.toLowerCase()}|${ownerPubkey}|${issuedAtIso}|${nonce}|v1`;
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Canonical string that should be signed by owner wallet/key.
 */
export function canonicalizeDeedPayload(payload: NameDeedPayload): string {
  return JSON.stringify({
    deedId: payload.deedId,
    name: payload.name.toLowerCase(),
    ownerPubkey: payload.ownerPubkey,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    nonce: payload.nonce,
    version: payload.version,
  });
}

export function canonicalizeTransferPayload(payload: NameDeedTransferPayload): string {
  return JSON.stringify({
    deedId: payload.deedId,
    name: payload.name.toLowerCase(),
    fromPubkey: payload.fromPubkey,
    toPubkey: payload.toPubkey,
    transferAt: payload.transferAt,
    expiresAt: payload.expiresAt,
    nonce: payload.nonce,
    askPriceSats: payload.askPriceSats ?? null,
    version: payload.version,
  });
}

/**
 * Suggested Nostr tag schema:
 * - ['t', 'name-deed']
 * - ['name', '<local-part>']
 * - ['deed', '<deedId>']
 * - ['owner', '<pubkey>']
 * - ['expires', '<iso8601>']
 */
export function buildDeedIssuedEventTemplate(
  deed: SignedNameDeed,
  createdAtUnix: number,
): NostrNameDeedEventTemplate {
  return {
    kind: NAME_DEED_EVENT_KINDS.deedIssued,
    content: JSON.stringify(deed),
    created_at: createdAtUnix,
    pubkey: deed.signerPubkey,
    tags: [
      ['t', 'name-deed'],
      ['name', deed.payload.name.toLowerCase()],
      ['deed', deed.payload.deedId],
      ['owner', deed.payload.ownerPubkey],
      ['expires', deed.payload.expiresAt],
      ['v', deed.payload.version],
    ],
  };
}
