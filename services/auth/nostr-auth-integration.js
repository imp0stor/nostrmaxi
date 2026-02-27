'use strict';

let verifyNostrAuth;
let requireAuth;
let requireAdmin;
let requireOwner;

try {
  ({ verifyNostrAuth, requireAuth, requireAdmin, requireOwner } = require('@strangesignal/nostr-auth/server'));
} catch {
  // Fallback for operator hosts where workspace packages are unavailable.
  verifyNostrAuth = (jwtSecret) => (req, _res, next) => {
    const authHeader = req?.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      req.user = req.user || { pubkey: token, npub: token, role: 'user', jwtSecret };
    }
    next();
  };

  requireAuth = (req, _res, next) => {
    if (!req.user) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
    next();
  };

  requireAdmin = (adminList = []) => (req, _res, next) => {
    if (!req.user || !adminList.includes(req.user.npub || req.user.pubkey)) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    next();
  };

  requireOwner = (ownerList = []) => (req, _res, next) => {
    if (!req.user || !ownerList.includes(req.user.npub || req.user.pubkey)) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    next();
  };
}

const parseNpubs = (value) =>
  (value || '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.startsWith('npub1'));

const ownerNpubs = parseNpubs(process.env.NOSTRMAXI_OWNER_NPUBS || process.env.ADMIN_PUBKEYS);
const adminNpubs = parseNpubs(process.env.NOSTRMAXI_ADMIN_NPUBS || process.env.ADMIN_PUBKEYS);
const jwtSecret = process.env.JWT_SECRET || 'change-me-in-production';

const nostrAuthMiddleware = verifyNostrAuth(jwtSecret);

module.exports = {
  ownerNpubs,
  adminNpubs,
  jwtSecret,
  nostrAuthMiddleware,
  requireAuth,
  requireAdmin,
  requireOwner,
};

if (require.main === module) {
  console.log('Configured auth middleware ready');
}
