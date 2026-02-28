import { ForbiddenException } from '@nestjs/common';
import { PremiumGuard } from '../auth/guards/premium.guard';

describe('PremiumGuard', () => {
  it('allows premium users', async () => {
    const premiumService = { isPremium: jest.fn().mockResolvedValue(true) };
    const guard = new PremiumGuard(premiumService as any);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { pubkey: 'abc123' },
          query: {},
        }),
      }),
    } as any;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(premiumService.isPremium).toHaveBeenCalledWith('abc123');
  });

  it('rejects when no pubkey is present', async () => {
    const premiumService = { isPremium: jest.fn() };
    const guard = new PremiumGuard(premiumService as any);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: undefined, query: {} }) }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(premiumService.isPremium).not.toHaveBeenCalled();
  });

  it('returns premium_required payload for non-premium users', async () => {
    const premiumService = { isPremium: jest.fn().mockResolvedValue(false) };
    const guard = new PremiumGuard(premiumService as any);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: undefined,
          query: { pubkey: 'def456' },
        }),
      }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: {
        error: 'premium_required',
        message: 'Analytics requires a NostrMaxi NIP-05 identity',
        upgrade_url: '/get-nip05',
      },
    });
    expect(premiumService.isPremium).toHaveBeenCalledWith('def456');
  });
});
