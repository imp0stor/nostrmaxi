import * as jwt from 'jsonwebtoken';
import { nip19 } from 'nostr-tools';

let verifyNostrAuth: (jwtSecret: string) => (req: any, res: any, next: () => void) => void;
let requireAuth: (req: any, res: any, next: () => void) => void;
let requireAdmin: (adminList?: string[]) => (req: any, res: any, next: () => void) => void;
let requireOwner: (ownerList?: string[]) => (req: any, res: any, next: () => void) => void;

try {
  ({ verifyNostrAuth, requireAuth, requireAdmin, requireOwner } = require('@strangesignal/nostr-auth/server'));
} catch {
  verifyNostrAuth = (jwtSecret: string) => (req: any, _res: any, next: () => void) => {
    const authHeader = req?.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      try {
        // Try to decode as JWT first
        const decoded = jwt.verify(token, jwtSecret) as { sub?: string; npub?: string; pubkey?: string; role?: string };
        // sub is the hex pubkey in our JWT implementation
        let pubkey = decoded.sub || decoded.pubkey || '';
        let npub = decoded.npub || '';
        
        // If we have pubkey but not npub, encode it
        if (pubkey && !npub) {
          npub = nip19.npubEncode(pubkey);
        }
        // If we have npub but not pubkey, decode it
        if (npub && !pubkey) {
          try {
            const dec = nip19.decode(npub);
            pubkey = typeof dec.data === 'string' ? dec.data : '';
          } catch {}
        }
        
        req.user = { pubkey, npub, role: decoded.role || 'user' };
      } catch {
        // If JWT decode fails, check if token itself is an npub
        if (token.startsWith('npub1')) {
          try {
            const dec = nip19.decode(token);
            const pubkey = typeof dec.data === 'string' ? dec.data : '';
            req.user = { pubkey, npub: token, role: 'user' };
          } catch {}
        }
      }
    }
    next();
  };

  requireAuth = (req: any, _res: any, next: () => void) => {
    if (!req.user) {
      const err: any = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
    next();
  };

  requireAdmin = (adminList: string[] = []) => (req: any, _res: any, next: () => void) => {
    if (!req.user || !adminList.includes(req.user.npub || req.user.pubkey)) {
      const err: any = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    next();
  };

  requireOwner = (ownerList: string[] = []) => (req: any, _res: any, next: () => void) => {
    if (!req.user || !ownerList.includes(req.user.npub || req.user.pubkey)) {
      const err: any = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    next();
  };
}

const parseNpubs = (value: string | undefined) =>
  (value || '')
    .split(',')
    .map((v: string) => v.trim())
    .filter((v: string) => v.startsWith('npub1'));

const ownerNpubs = parseNpubs(process.env.NOSTRMAXI_OWNER_NPUBS || process.env.ADMIN_PUBKEYS);
const adminNpubs = parseNpubs(process.env.NOSTRMAXI_ADMIN_NPUBS || process.env.ADMIN_PUBKEYS);
const jwtSecret = process.env.JWT_SECRET || 'change-me-in-production';

const nostrAuthMiddleware = verifyNostrAuth(jwtSecret);

export {
  ownerNpubs,
  adminNpubs,
  jwtSecret,
  nostrAuthMiddleware,
  requireAuth,
  requireAdmin,
  requireOwner,
};
