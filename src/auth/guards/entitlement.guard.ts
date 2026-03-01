import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const ANALYTICS_ALLOWED_TIERS = new Set(['PRO', 'BUSINESS', 'LIFETIME']);

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const pubkey = request.user?.pubkey || request.query?.pubkey || request.params?.pubkey;

    if (!pubkey) {
      throw new ForbiddenException('Authentication required');
    }

    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      include: { subscription: true },
    });

    if (user?.isAdmin === true) {
      return true;
    }

    const tier = user?.subscription?.tier || 'FREE';
    if (!ANALYTICS_ALLOWED_TIERS.has(tier)) {
      throw new ForbiddenException({
        error: 'paid_entitlement_required',
        message: 'This feature requires Pro, Business, or Lifetime subscription.',
        upgrade_url: '/pricing',
      });
    }

    return true;
  }
}
