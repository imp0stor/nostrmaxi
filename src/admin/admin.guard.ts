import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly bootstrapAdminPubkeys: Set<string>;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const raw = this.config.get<string>('ADMIN_PUBKEYS', '');
    this.bootstrapAdminPubkeys = new Set(
      raw
        .split(',')
        .map((pubkey) => pubkey.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ pubkey?: string }>();
    const pubkey = req.pubkey?.trim().toLowerCase();

    if (!pubkey) {
      throw new ForbiddenException('Admin access required');
    }

    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      select: { isAdmin: true },
    });

    if (user?.isAdmin) {
      return true;
    }

    // Bootstrap fallback: allow env admins even before/without DB sync.
    if (this.bootstrapAdminPubkeys.has(pubkey)) {
      return true;
    }

    throw new ForbiddenException('Admin access required');
  }
}
