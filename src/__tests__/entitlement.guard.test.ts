import { ForbiddenException } from '@nestjs/common';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';

describe('EntitlementGuard', () => {
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ user: { pubkey: 'abc' }, query: {}, params: {} }),
    }),
  } as any;

  it('allows PRO/BUSINESS/LIFETIME users', async () => {
    for (const tier of ['PRO', 'BUSINESS', 'LIFETIME']) {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ subscription: { tier } }),
        },
      } as any;
      const guard = new EntitlementGuard(prisma);

      await expect(guard.canActivate(context)).resolves.toBe(true);
    }
  });

  it('allows admins regardless of tier', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ isAdmin: true, subscription: { tier: 'FREE' } }),
      },
    } as any;
    const guard = new EntitlementGuard(prisma);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects free tier users with upgrade payload', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ isAdmin: false, subscription: { tier: 'FREE' } }),
      },
    } as any;
    const guard = new EntitlementGuard(prisma);

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: {
        error: 'paid_entitlement_required',
        upgrade_url: '/pricing',
      },
    });
  });

  it('rejects when no pubkey is present', async () => {
    const prisma = { user: { findUnique: jest.fn() } } as any;
    const guard = new EntitlementGuard(prisma);
    const noPubkeyContext = {
      switchToHttp: () => ({ getRequest: () => ({ user: undefined, query: {}, params: {} }) }),
    } as any;

    await expect(guard.canActivate(noPubkeyContext)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
