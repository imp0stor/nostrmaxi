import { OWNERSHIP_POLICY, createOwnershipWindow, getOwnershipStatus, quoteRenewal } from '../config/name-ownership';
import { computeDeedId } from '../types/name-deed';

describe('name ownership model', () => {
  it('creates default 1-year ownership windows', () => {
    const issuedAt = new Date('2026-01-01T00:00:00.000Z');
    const window = createOwnershipWindow(issuedAt);

    expect(window.termDays).toBe(OWNERSHIP_POLICY.defaultTermDays);
    expect(window.expiresAt).toBe('2027-01-01T00:00:00.000Z');
  });

  it('returns grace status after expiration within grace period', () => {
    const record = {
      name: 'alice',
      ownerPubkey: 'pubkey',
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-02-01T00:00:00.000Z',
      graceUntil: '2026-03-01T00:00:00.000Z',
    };

    expect(getOwnershipStatus(record, new Date('2026-02-15T00:00:00.000Z'))).toBe('grace');
  });

  it('applies late renewal penalty in grace period', () => {
    const quote = quoteRenewal(1000, 1.5, 'grace');
    expect(quote.latePenaltyApplied).toBe(true);
    expect(quote.renewalPriceSats).toBe(1875);
  });

  it('computes deterministic deed ids', () => {
    const a = computeDeedId('alice', 'pubkey', '2026-01-01T00:00:00.000Z', 'nonce-1');
    const b = computeDeedId('alice', 'pubkey', '2026-01-01T00:00:00.000Z', 'nonce-1');
    expect(a).toEqual(b);
  });
});
