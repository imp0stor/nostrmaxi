import * as jwt from 'jsonwebtoken';
import { nip19 } from 'nostr-tools';

let verifyNostrAuth: (jwtSecret: string) => (req: any, res: any, next: () => void) => void;
let requireAuth: (req: any, res: any, next: () => void) => void;
let requireAdmin: (adminList?: string[]) => (req: any, res: any, next: () => void) => void;
let requireOwner: (ownerList?: string[]) => (req: any, res: any, next: () => void) => void;

const isHexPubkey = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);

const isNpub = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('npub1');

const deriveAuthIdentity = (decoded: { sub?: string; npub?: string; pubkey?: string }) => {
  // Some historical tokens used sub/npub/pubkey inconsistently, so normalize defensively.
  let pubkey = isHexPubkey(decoded.sub)
    ? decoded.sub
    : isHexPubkey(decoded.pubkey)
      ? decoded.pubkey
      : '';

  let npub = isNpub(decoded.npub) ? decoded.npub : '';

  if (!pubkey && isNpub(decoded.sub)) {
    try {
      const fromSub = nip19.decode(decoded.sub);
      pubkey = typeof fromSub.data === 'string' ? fromSub.data : '';
      npub = decoded.sub;
    } catch {
      // ignore invalid legacy token shape
    }
  }

  if (!pubkey && isNpub(decoded.pubkey)) {
    try {
      const fromPubkey = nip19.decode(decoded.pubkey);
      pubkey = typeof fromPubkey.data === 'string' ? fromPubkey.data : '';
      npub = decoded.pubkey;
    } catch {
      // ignore invalid legacy token shape
    }
  }

  if (pubkey && !npub) {
    try {
      npub = nip19.npubEncode(pubkey);
    } catch {
      // If npub encoding fails we still keep pubkey-based auth.
      npub = '';
    }
  }

  return { pubkey, npub };
};

try {
  ({ verifyNostrAuth, requireAuth, requireAdmin, requireOwner } = require('@strangesignal/nostr-auth/server'));
} catch {
  verifyNostrAuth = (jwtSecret: string) => (req: any, _res: any, next: () => void) => {
    const authHeader = req?.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
      try {
        const decoded = jwt.verify(token, jwtSecret) as { sub?: string; npub?: string; pubkey?: string; role?: string };
        const { pubkey, npub } = deriveAuthIdentity(decoded);

        if (pubkey) {
          req.user = { pubkey, npub, role: decoded.role || 'user' };
        }
      } catch {
        // If JWT decode fails, support direct npub bearer tokens for legacy callers.
        if (isNpub(token)) {
          try {
            const dec = nip19.decode(token);
            const pubkey = typeof dec.data === 'string' ? dec.data : '';
            if (pubkey) {
              req.user = { pubkey, npub: token, role: 'user' };
            }
          } catch {
            // invalid direct npub token; leave req.user unset
          }
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
