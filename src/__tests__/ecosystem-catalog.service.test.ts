import { EcosystemCatalogService } from '../ecosystem-catalog/ecosystem-catalog.service';

describe('EcosystemCatalogService', () => {
  const service = new EcosystemCatalogService();

  it('returns ranked catalog results', async () => {
    const result = await service.list({ category: 'developer-tools' });
    expect(result.total).toBeGreaterThan(0);
    expect(result.entries[0].rankingScore).toBeGreaterThanOrEqual(result.entries[result.entries.length - 1].rankingScore);
  });

  it('filters by NIP', async () => {
    const result = await service.list({ nip: 'NIP-57' });
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.entries.every((entry) => entry.supportedNips.includes('NIP-57'))).toBe(true);
  });
});
