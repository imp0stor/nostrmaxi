import { getReservedNameMeta, PRICING_MULTIPLIERS, ReservedCategory } from './reserved-names';

export const NAME_PRICE_TIERS = {
  base5Plus: 21000,
  short4: 210000,
  short3: 2100000,
  short2: 21000000,
  short1: 210000000,
} as const;

export type NamePricingTier =
  | 'base'
  | 'short-4'
  | 'short-3'
  | 'short-2'
  | 'short-1'
  | 'reserved-fixed'
  | 'reserved-auction'
  | 'blocked';

export interface NamePricingQuote {
  input: string;
  normalized: string;
  length: number;
  tier: NamePricingTier;
  priceSats: number | null;
  auctionOnly: boolean;
  reserved: boolean;
  reservedCategory?: ReservedCategory;
  reason?: string;
  marketplaceRequired: boolean;
}

export function normalizeNameInput(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
}

function getLengthTierPrice(length: number): { tier: NamePricingTier; priceSats: number; auctionOnly: boolean } {
  if (length <= 1) return { tier: 'short-1', priceSats: NAME_PRICE_TIERS.short1, auctionOnly: true };
  if (length === 2) return { tier: 'short-2', priceSats: NAME_PRICE_TIERS.short2, auctionOnly: true };
  if (length === 3) return { tier: 'short-3', priceSats: NAME_PRICE_TIERS.short3, auctionOnly: false };
  if (length === 4) return { tier: 'short-4', priceSats: NAME_PRICE_TIERS.short4, auctionOnly: false };
  return { tier: 'base', priceSats: NAME_PRICE_TIERS.base5Plus, auctionOnly: false };
}

export function quoteNamePrice(name: string): NamePricingQuote {
  const normalized = normalizeNameInput(name);
  const length = normalized.length;

  const lengthTier = getLengthTierPrice(length);
  const reservedMeta = getReservedNameMeta(normalized);

  if (!normalized) {
    return {
      input: name,
      normalized,
      length,
      tier: 'blocked',
      priceSats: null,
      auctionOnly: false,
      reserved: true,
      marketplaceRequired: false,
      reason: 'invalid empty name after normalization',
    };
  }

  if (!reservedMeta) {
    return {
      input: name,
      normalized,
      length,
      tier: lengthTier.tier,
      priceSats: lengthTier.priceSats,
      auctionOnly: lengthTier.auctionOnly,
      reserved: false,
      marketplaceRequired: lengthTier.auctionOnly,
      reason:
        lengthTier.auctionOnly
          ? 'ultra-short name (1-2 chars) requires auction flow'
          : 'standard length-based pricing',
    };
  }

  if (reservedMeta.category === 'blocked') {
    return {
      input: name,
      normalized,
      length,
      tier: 'blocked',
      priceSats: null,
      auctionOnly: false,
      reserved: true,
      reservedCategory: reservedMeta.category,
      marketplaceRequired: false,
      reason: reservedMeta.reason,
    };
  }

  if (reservedMeta.auctionOnly) {
    return {
      input: name,
      normalized,
      length,
      tier: 'reserved-auction',
      priceSats: null,
      auctionOnly: true,
      reserved: true,
      reservedCategory: reservedMeta.category,
      marketplaceRequired: true,
      reason: reservedMeta.reason,
    };
  }

  const fallbackMultiplier =
    reservedMeta.multiplier ??
    (reservedMeta.category === 'stopWords'
      ? PRICING_MULTIPLIERS.stopWords
      : reservedMeta.category === 'commonFirstNames'
        ? PRICING_MULTIPLIERS.commonFirstNames
        : PRICING_MULTIPLIERS.base);

  return {
    input: name,
    normalized,
    length,
    tier: 'reserved-fixed',
    priceSats: reservedMeta.marketplacePriceSats ?? Math.round(NAME_PRICE_TIERS.base5Plus * fallbackMultiplier),
    auctionOnly: false,
    reserved: true,
    reservedCategory: reservedMeta.category,
    marketplaceRequired: true,
    reason: reservedMeta.reason,
  };
}

export function canDirectlyRegisterName(name: string): { allowed: boolean; quote: NamePricingQuote; message?: string } {
  const quote = quoteNamePrice(name);

  if (quote.tier === 'blocked') {
    return {
      allowed: false,
      quote,
      message: `"${quote.normalized || name}" is blocked and cannot be registered`,
    };
  }

  if (quote.marketplaceRequired) {
    return {
      allowed: false,
      quote,
      message: quote.auctionOnly
        ? `"${quote.normalized}" is reserved and must be acquired via auction marketplace`
        : `"${quote.normalized}" is reserved and must be purchased in marketplace`,
    };
  }

  return { allowed: true, quote };
}
