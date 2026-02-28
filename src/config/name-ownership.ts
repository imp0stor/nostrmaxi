export const OWNERSHIP_POLICY = {
  defaultTermDays: 365,
  minTermDays: 30,
  maxTermDays: 3650, // 10 years
  gracePeriodDays: 30,
  transferCooldownHours: 24,
  lateRenewalPenaltyMultiplier: 1.25,
} as const;

export const RENEWAL_MULTIPLIERS = {
  base: 1,
  short4: 1.15,
  short3: 1.35,
  short2: 1.75,
  short1: 2.5,
  reservedFixed: 1.5,
  reservedAuction: 1.75,
} as const;

export type OwnershipStatus = 'active' | 'grace' | 'expired';

export interface NameOwnershipWindow {
  issuedAt: string;
  expiresAt: string;
  graceUntil: string;
  termDays: number;
}

export interface RenewalQuote {
  basePriceSats: number;
  renewalPriceSats: number;
  multiplier: number;
  inGrace: boolean;
  latePenaltyApplied: boolean;
}

export interface OwnershipRecord {
  name: string;
  ownerPubkey: string;
  issuedAt: string;
  expiresAt: string;
  graceUntil: string;
  lastTransferAt?: string;
}

export function createOwnershipWindow(
  issuedAt: Date = new Date(),
  termDays: number = OWNERSHIP_POLICY.defaultTermDays,
): NameOwnershipWindow {
  const safeTerm = Math.min(
    OWNERSHIP_POLICY.maxTermDays,
    Math.max(OWNERSHIP_POLICY.minTermDays, termDays),
  );

  const expiresAt = new Date(issuedAt.getTime() + safeTerm * 24 * 60 * 60 * 1000);
  const graceUntil = new Date(
    expiresAt.getTime() + OWNERSHIP_POLICY.gracePeriodDays * 24 * 60 * 60 * 1000,
  );

  return {
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    graceUntil: graceUntil.toISOString(),
    termDays: safeTerm,
  };
}

export function getOwnershipStatus(record: OwnershipRecord, now: Date = new Date()): OwnershipStatus {
  const expiresAt = new Date(record.expiresAt).getTime();
  const graceUntil = new Date(record.graceUntil).getTime();
  const nowMs = now.getTime();

  if (nowMs <= expiresAt) return 'active';
  if (nowMs <= graceUntil) return 'grace';
  return 'expired';
}

export function canTransfer(record: OwnershipRecord, now: Date = new Date()): boolean {
  if (getOwnershipStatus(record, now) !== 'active') return false;

  if (!record.lastTransferAt) return true;
  const sinceTransferMs = now.getTime() - new Date(record.lastTransferAt).getTime();
  const cooldownMs = OWNERSHIP_POLICY.transferCooldownHours * 60 * 60 * 1000;
  return sinceTransferMs >= cooldownMs;
}

export function quoteRenewal(
  basePriceSats: number,
  multiplier: number = RENEWAL_MULTIPLIERS.base,
  status: OwnershipStatus = 'active',
): RenewalQuote {
  const inGrace = status === 'grace';
  const latePenaltyApplied = inGrace;

  const graceAdjustedMultiplier = latePenaltyApplied
    ? multiplier * OWNERSHIP_POLICY.lateRenewalPenaltyMultiplier
    : multiplier;

  return {
    basePriceSats,
    multiplier: graceAdjustedMultiplier,
    renewalPriceSats: Math.round(basePriceSats * graceAdjustedMultiplier),
    inGrace,
    latePenaltyApplied,
  };
}
