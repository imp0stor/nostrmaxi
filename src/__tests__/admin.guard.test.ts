import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';

describe('AdminGuard', () => {
  function makeContext(pubkey?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ pubkey }),
      }),
    } as unknown as ExecutionContext;
  }

  function makeGuard(opts?: { dbAdmin?: boolean; envAdminPubkeys?: string }) {
    return new AdminGuard(
      {
        get: (_key: string, fallback = '') => opts?.envAdminPubkeys ?? fallback,
      } as any,
      {
        user: {
          findUnique: jest.fn().mockResolvedValue(
            typeof opts?.dbAdmin === 'boolean' ? { isAdmin: opts.dbAdmin } : null,
          ),
        },
      } as any,
    );
  }

  it('allows pubkeys with isAdmin=true in database', async () => {
    const guard = makeGuard({ dbAdmin: true });

    await expect(guard.canActivate(makeContext('a'.repeat(64)))).resolves.toBe(true);
  });

  it('allows bootstrap pubkeys configured in ADMIN_PUBKEYS as fallback', async () => {
    const guard = makeGuard({ dbAdmin: false, envAdminPubkeys: 'a'.repeat(64) });

    await expect(guard.canActivate(makeContext('A'.repeat(64)))).resolves.toBe(true);
  });

  it('throws ForbiddenException for non-admin pubkeys', async () => {
    const guard = makeGuard({ dbAdmin: false, envAdminPubkeys: 'a'.repeat(64) });

    await expect(guard.canActivate(makeContext('b'.repeat(64)))).rejects.toThrow(ForbiddenException);
  });
});
