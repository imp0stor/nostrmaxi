import { nip19 } from 'nostr-tools';

describe('Nostr auth integration permissions', () => {
  const ownerPubkey = 'f'.repeat(64);
  const ownerNpub = nip19.npubEncode(ownerPubkey);

  beforeAll(() => {
    process.env.NOSTRMAXI_OWNER_NPUBS = ownerNpub;
    process.env.NOSTRMAXI_ADMIN_NPUBS = ownerNpub;
    jest.resetModules();
  });

  it('loads owner/admin npub lists from integration config', () => {
    const integration = require('../../services/auth/nostr-auth-integration.js');
    expect(integration.ownerNpubs).toContain(ownerNpub);
    expect(integration.adminNpubs).toContain(ownerNpub);
  });

  it('allows owner through admin and owner guards', () => {
    const { NostrAdminGuard, NostrOwnerGuard } = require('../auth/nostr-role.guard');

    const ctx: any = {
      switchToHttp: () => ({ getRequest: () => ({ npub: ownerNpub }) }),
    };

    expect(new NostrAdminGuard().canActivate(ctx)).toBe(true);
    expect(new NostrOwnerGuard().canActivate(ctx)).toBe(true);
  });
});
