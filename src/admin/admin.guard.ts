import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly adminPubkeys: Set<string>;

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>('ADMIN_PUBKEYS', '');
    this.adminPubkeys = new Set(
      raw
        .split(',')
        .map((pubkey) => pubkey.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ pubkey?: string }>();
    const pubkey = req.pubkey?.trim().toLowerCase();

    if (!pubkey || !this.adminPubkeys.has(pubkey)) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
