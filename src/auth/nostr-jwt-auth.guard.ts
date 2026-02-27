import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { nip19 } from 'nostr-tools';

// Proven middleware integration from shared package adapter
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { nostrAuthMiddleware } = require('../services/auth/nostr-auth-integration');

@Injectable()
export class NostrJwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: { npub?: string } }>();
    const res = context.switchToHttp().getResponse<Response>();

    return new Promise<boolean>((resolve, reject) => {
      nostrAuthMiddleware(req as any, res as any, () => {
        if (!req.user?.npub) {
          return reject(new UnauthorizedException('Authenticated token missing npub'));
        }

        try {
          const decoded = nip19.decode(req.user.npub);
          const pubkey = typeof decoded.data === 'string' ? decoded.data : '';
          if (!pubkey) {
            return reject(new UnauthorizedException('Invalid npub in auth token'));
          }

          (req as any).npub = req.user.npub;
          (req as any).pubkey = pubkey;
          resolve(true);
        } catch {
          return reject(new UnauthorizedException('Invalid npub in auth token'));
        }
      });
    }).catch((err) => {
      if (err?.status) throw err;
      throw new UnauthorizedException('Invalid auth token');
    });
  }
}
