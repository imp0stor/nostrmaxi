import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ownerNpubs, adminNpubs } = require('../services/auth/nostr-auth-integration');

@Injectable()
export class NostrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ npub?: string }>();
    const npub = req.npub;

    if (!npub) {
      throw new ForbiddenException('Missing authenticated npub');
    }

    const allowed = new Set<string>([...ownerNpubs, ...adminNpubs]);
    if (!allowed.has(npub)) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}

@Injectable()
export class NostrOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ npub?: string }>();
    const npub = req.npub;

    if (!npub) {
      throw new ForbiddenException('Missing authenticated npub');
    }

    if (!ownerNpubs.includes(npub)) {
      throw new ForbiddenException('Owner access required');
    }

    return true;
  }
}
