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

  it('allows pubkeys configured in ADMIN_PUBKEYS', () => {
    const guard = new AdminGuard({
      get: () => `a`.repeat(64),
    } as any);

    expect(guard.canActivate(makeContext('A'.repeat(64)))).toBe(true);
  });

  it('throws ForbiddenException for non-admin pubkeys', () => {
    const guard = new AdminGuard({
      get: () => `a`.repeat(64),
    } as any);

    expect(() => guard.canActivate(makeContext('b'.repeat(64)))).toThrow(ForbiddenException);
  });
});
