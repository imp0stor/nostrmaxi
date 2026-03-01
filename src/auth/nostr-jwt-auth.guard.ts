import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { nip19 } from 'nostr-tools';
import * as jwt from 'jsonwebtoken';

// Proven middleware integration from shared package adapter
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { nostrAuthMiddleware } = require('../services/auth/nostr-auth-integration');

@Injectable()
export class NostrJwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: { npub?: string; pubkey?: string } }>();
    const res = context.switchToHttp().getResponse<Response>();

    return new Promise<boolean>((resolve, reject) => {
      nostrAuthMiddleware(req as any, res as any, (err?: unknown) => {
        // If middleware returned an error but still populated req.user, allow normalized flow.
        if (err && !req.user) {
          return reject(err);
        }

        // Recover user from JWT if middleware failed to populate req.user
        // or produced an incomplete user object.
        if (!req.user || (!req.user.pubkey && !req.user.npub)) {
          const authHeader = (req.headers as any)?.authorization as string | undefined;
          const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
          if (token) {
            try {
              const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-jwt-secret') as any;
              const recoveredPubkey = payload?.sub || payload?.pubkey;
              if (typeof recoveredPubkey === 'string' && recoveredPubkey.length > 10) {
                req.user = { pubkey: recoveredPubkey, npub: nip19.npubEncode(recoveredPubkey) };
              }
            } catch {
              // no-op: handled below
            }
          }
        }

        // Check if we have user data from middleware / recovery
        if (!req.user) {
          console.error('[GUARD] No req.user set by middleware');
          return reject(new UnauthorizedException('Authentication required'));
        }

        // Use pubkey directly if available (set by middleware from JWT)
        let pubkey = req.user.pubkey || '';
        let npub = req.user.npub || '';

        // If we have pubkey but not npub, encode it
        if (pubkey && !npub) {
          try {
            npub = nip19.npubEncode(pubkey);
          } catch (e) {
            console.error('[GUARD] Failed to encode npub:', e);
          }
        }

        // If we have npub but not pubkey, decode it
        if (npub && !pubkey) {
          try {
            const decoded = nip19.decode(npub);
            pubkey = typeof decoded.data === 'string' ? decoded.data : '';
          } catch (e) {
            console.error('[GUARD] Failed to decode npub:', e);
          }
        }

        // Must have at least pubkey to proceed
        if (!pubkey) {
          console.error('[GUARD] No pubkey available, user:', req.user);
          return reject(new UnauthorizedException('Invalid auth token - no pubkey'));
        }

        (req as any).npub = npub;
        (req as any).pubkey = pubkey;
        resolve(true);
      });
    }).catch((err) => {
      if (err?.status) throw err;
      throw new UnauthorizedException('Invalid auth token');
    });
  }
}
