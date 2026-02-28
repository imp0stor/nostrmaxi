import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ownerNpubs, adminNpubs } = require('../services/auth/nostr-auth-integration');

@Injectable()
export class NostrAdminGuard implements CanActivate {
  constructor(private readonly prisma?: PrismaService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ npub?: string; pubkey?: string }>();
    const npub = req.npub;

    if (!npub) {
      throw new ForbiddenException('Missing authenticated npub');
    }

    const allowed = new Set<string>([...ownerNpubs, ...adminNpubs]);
    if (allowed.has(npub)) {
      return true;
    }

    if (!req.pubkey) {
      throw new ForbiddenException('Admin access required');
    }

    if (!this.prisma) {
      throw new ForbiddenException('Admin access required');
    }

    return this.prisma.user
      .findUnique({
        where: { pubkey: req.pubkey },
        select: { isAdmin: true },
      })
      .then((user) => {
        if (!user?.isAdmin) {
          throw new ForbiddenException('Admin access required');
        }
        return true;
      });
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
