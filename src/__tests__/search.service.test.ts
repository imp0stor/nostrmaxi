import { SearchService } from '../search/search.service';

describe('SearchService', () => {
  const beaconClient = {
    search: jest.fn(),
    searchFiltered: jest.fn(),
  } as any;

  const metrics = {
    recordRequest: jest.fn(),
    recordCacheHit: jest.fn(),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
  } as any;

  const configService = {
    get: jest.fn(() => '120000'),
  } as any;

  const cacheStore = new Map<string, any>();
  const cacheManager = {
    get: jest.fn(async (k: string) => cacheStore.get(k)),
    set: jest.fn(async (k: string, v: any) => cacheStore.set(k, v)),
  } as any;

  const service = new SearchService(beaconClient, metrics, configService, cacheManager);

  beforeEach(() => {
    jest.clearAllMocks();
    cacheStore.clear();
  });

  it('returns beacon response with nostrmaxi metadata', async () => {
    beaconClient.search.mockResolvedValue({ results: [{ id: '1' }] });

    const result: any = await service.search({ q: 'nostr', limit: '10', facets: 'true' });

    expect(result.results).toHaveLength(1);
    expect(result.nostrmaxi.source).toBe('beacon');
    expect(metrics.recordSuccess).toHaveBeenCalled();
  });

  it('serves cached response on repeat request', async () => {
    beaconClient.search.mockResolvedValue({ results: [{ id: '1' }] });

    await service.search({ q: 'nostr' });
    const second: any = await service.search({ q: 'nostr' });

    expect(second.nostrmaxi.source).toBe('cache');
    expect(metrics.recordCacheHit).toHaveBeenCalled();
  });

  it('falls back gracefully when beacon fails', async () => {
    beaconClient.searchFiltered.mockRejectedValue(new Error('beacon unavailable'));

    const result: any = await service.searchFiltered({ q: 'nostr', facets: '1' });

    expect(result.results).toEqual([]);
    expect(result.nostrmaxi.source).toBe('fallback');
    expect(result.nostrmaxi.error).toContain('beacon unavailable');
    expect(metrics.recordFailure).toHaveBeenCalled();
  });
});
