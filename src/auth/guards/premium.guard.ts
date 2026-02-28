import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PremiumService } from '../premium.service';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(private readonly premiumService: PremiumService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const pubkey = request.user?.pubkey || request.query?.pubkey;

    if (!pubkey) {
      throw new ForbiddenException('Authentication required');
    }

    const isPremium = await this.premiumService.isPremium(pubkey);

    if (!isPremium) {
      throw new ForbiddenException({
        error: 'premium_required',
        message: 'Analytics requires a NostrMaxi NIP-05 identity',
        upgrade_url: '/get-nip05',
      });
    }

    return true;
  }
}
