import { ForbiddenException } from '@nestjs/common';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';

describe('EntitlementGuard', () => {
  it('allows paid users', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ subscription: { tier: 'PRO' } }),
      },
    } as any;
    const guard = new EntitlementGuard(prisma);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { pubkey: 'abc' }, query: {}, params: {} }),
      }),
    } as any;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects free tier users with upgrade payload', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ subscription: { tier: 'FREE' } }),
      },
    } as any;
    const guard = new EntitlementGuard(prisma);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { pubkey: 'abc' }, query: {}, params: {} }),
      }),
    } as any;

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
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: undefined, query: {}, params: {} }) }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
