import { getReservedNamesCount, getReservedNameMeta } from '../config/reserved-names';
import { canDirectlyRegisterName, quoteNamePrice } from '../config/name-pricing';

describe('name pricing + reserved policy', () => {
  it('has 500+ reserved names', () => {
    expect(getReservedNamesCount()).toBeGreaterThanOrEqual(500);
  });

  it('blocks admin-like names', () => {
    const result = canDirectlyRegisterName('admin');
    expect(result.allowed).toBe(false);
    expect(result.quote.tier).toBe('blocked');
  });

  it('routes prominent names to auction marketplace', () => {
    const result = canDirectlyRegisterName('jack');
    expect(result.allowed).toBe(false);
    expect(result.quote.tier).toBe('reserved-auction');
    expect(result.quote.auctionOnly).toBe(true);
  });

  it('marks single-char names as auction-only', () => {
    const result = canDirectlyRegisterName('a');
    expect(result.allowed).toBe(false);
    expect(result.quote.marketplaceRequired).toBe(true);
  });

  it('returns standard base pricing for normal names', () => {
    const quote = quoteNamePrice('nostrbuilder');
    expect(quote.tier).toBe('base');
    expect(quote.priceSats).toBe(21000);
    expect(quote.marketplaceRequired).toBe(false);
  });

  it('contains known categories metadata', () => {
    expect(getReservedNameMeta('bitcoin')?.category).toBe('cryptoTerms');
    expect(getReservedNameMeta('google')?.category).toBe('brands');
  });
});
