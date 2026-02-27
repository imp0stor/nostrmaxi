import { BadRequestException } from '@nestjs/common';
import { nip19 } from 'nostr-tools';
import { IdentityService } from '../identity/identity.service';

describe('IdentityService', () => {
  const pubkey = 'a'.repeat(64);
  const npub = nip19.npubEncode(pubkey);

  const authService = {
    getOrCreateUser: jest.fn(),
  } as any;

  const prisma = {
    user: { findUnique: jest.fn() },
  } as any;

  const wotService = {
    verify: jest.fn(),
  } as any;

  const webhooks = {
    emit: jest.fn(),
  } as any;

  const service = new IdentityService(authService, prisma, wotService, webhooks);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('verifies identity with pubkey and emits webhook', async () => {
    authService.getOrCreateUser.mockResolvedValue({
      subscription: { tier: 'PRO' },
      nip05s: [{ localPart: 'adam', domain: 'nostrmaxi.com', isActive: true }],
    });
    wotService.verify.mockResolvedValue({ verified: true, score: 89, reason: 'trusted' });

    const result = await service.verifyIdentity({ npub: pubkey, minScore: 70, callbackUrl: 'https://example.com/hook' } as any);

    expect(result).toMatchObject({
      npub,
      pubkey,
      verified: true,
      score: 89,
      minScore: 70,
      tier: 'PRO',
      nip05s: ['adam@nostrmaxi.com'],
    });
    expect(webhooks.emit).toHaveBeenCalledWith('identity.verification.completed', expect.any(Object), 'https://example.com/hook');
  });

  it('returns not-found payload for unknown identity', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.getIdentity(pubkey);

    expect(result).toEqual({ found: false, pubkey, npub });
  });

  it('returns full identity profile when found', async () => {
    prisma.user.findUnique.mockResolvedValue({
      pubkey,
      npub,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      subscription: { tier: 'FREE' },
      nip05s: [{ localPart: 'satoshi', domain: 'nostrmaxi.com', createdAt: new Date('2026-01-02T00:00:00Z') }],
      wotScore: {
        trustScore: 77,
        isLikelyBot: false,
        discountPercent: 10,
        lastCalculated: new Date('2026-01-03T00:00:00Z'),
      },
    });

    const result = await service.getIdentity(pubkey);
    expect(result.found).toBe(true);
    expect((result as any).nip05s[0].address).toBe('satoshi@nostrmaxi.com');
    expect((result as any).wot.trustScore).toBe(77);
  });

  it('throws on invalid key format', async () => {
    await expect(service.getIdentity('not-a-valid-key')).rejects.toThrow(BadRequestException);
  });
});
