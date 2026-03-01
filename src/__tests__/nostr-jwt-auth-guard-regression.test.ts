import * as jwt from 'jsonwebtoken';

jest.mock('@strangesignal/nostr-auth/server', () => ({
  verifyNostrAuth: () => (_req: any, _res: any, next: (err?: unknown) => void) => {
    next(new Error('Invalid npub in auth token'));
  },
  requireAuth: (_req: any, _res: any, next: () => void) => next(),
  requireAdmin: () => (_req: any, _res: any, next: () => void) => next(),
  requireOwner: () => (_req: any, _res: any, next: () => void) => next(),
}), { virtual: true });

describe('Nostr JWT auth guard regression', () => {
  const jwtSecret = 'test-jwt-secret-at-least-32-characters-long';
  const pubkey = '9fdd0d57238ba01f8c04199ca3c0174fa17c19d28e9de610b9db22729e57310e';

  beforeEach(() => {
    process.env.JWT_SECRET = jwtSecret;
    jest.resetModules();
  });

  it('recovers req.user from JWT when upstream middleware throws npub validation error', async () => {
    const token = jwt.sign({ sub: pubkey }, jwtSecret);
    const req: any = {
      headers: { authorization: `Bearer ${token}` },
    };

    const { nostrAuthMiddleware } = require('../services/auth/nostr-auth-integration');

    await new Promise<void>((resolve, reject) => {
      nostrAuthMiddleware(req, {}, (err?: unknown) => {
        if (err) return reject(err);
        resolve();
      });
    });

    expect(req.user).toBeDefined();
    expect(req.user.pubkey).toBe(pubkey);
    expect(typeof req.user.npub).toBe('string');
    expect(req.user.npub.startsWith('npub1')).toBe(true);
  });

  it('guard sets request pubkey/npub and allows activation with recovered user', async () => {
    const token = jwt.sign({ sub: pubkey }, jwtSecret);
    const req: any = {
      headers: { authorization: `Bearer ${token}` },
    };

    const context: any = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
    };

    const { NostrJwtAuthGuard } = require('../auth/nostr-jwt-auth.guard');
    const guard = new NostrJwtAuthGuard();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.pubkey).toBe(pubkey);
    expect(typeof req.npub).toBe('string');
    expect(req.npub.startsWith('npub1')).toBe(true);
  });
});
