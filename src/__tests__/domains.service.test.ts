import { DomainsService } from '../domains/domains.service';
import { createMockPrismaService } from './mocks/prisma.mock';

describe('DomainsService', () => {
  let prisma: any;
  let service: DomainsService;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    await prisma.user.create({ data: { pubkey: 'a'.repeat(64), npub: 'npub-test', lightningAddress: 'alice@wallet.example.com' } });
    service = new DomainsService(prisma, async () => []);
  });

  it('creates domain with verification token and instructions', async () => {
    const result = await service.createDomain('a'.repeat(64), { domain: 'mydomain.com' });

    expect(result.domain).toBe('mydomain.com');
    expect(result.verifyToken).toBeTruthy();
    expect(result.instructions.value).toContain('nostrmaxi-verify=');
  });

  it('verifies domain when TXT matches token', async () => {
    const created = await service.createDomain('a'.repeat(64), { domain: 'mydomain.com' });

    service = new DomainsService(prisma, async () => [[`nostrmaxi-verify=${created.verifyToken}`]]);
    const verified = await service.verifyDomain('a'.repeat(64), created.id);

    expect(verified.verified).toBe(true);
  });

  it('returns unverified response when TXT missing', async () => {
    const created = await service.createDomain('a'.repeat(64), { domain: 'mydomain.com' });

    const verifyResult = await service.verifyDomain('a'.repeat(64), created.id);
    expect(verifyResult.verified).toBe(false);
    expect(verifyResult.message).toContain('TXT record not found');
  });
});
