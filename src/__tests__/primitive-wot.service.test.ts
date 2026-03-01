const querySyncMock = jest.fn();

jest.mock('nostr-tools', () => ({
  SimplePool: jest.fn().mockImplementation(() => ({
    querySync: querySyncMock,
    close: jest.fn(),
  })),
  nip19: {
    decode: jest.fn((v: string) => ({ data: v.replace(/^npub1/, '') })),
  },
}));

jest.mock('@strangesignal/nostr-wot-voting', () => ({
  buildFollowGraph: jest.fn((events: Array<{ pubkey: string; tags: string[][] }>) => {
    const graph: Record<string, string[]> = {};
    for (const evt of events) {
      graph[evt.pubkey] = (evt.tags || []).filter((t) => t[0] === 'p' && t[1]).map((t) => t[1]);
    }
    return graph;
  }),
  calculateWoTDistance: jest.fn((anchor: string, target: string, graph: Record<string, string[]>) => {
    if (graph[anchor]?.includes(target)) return 1;
    const firstHop = graph[anchor] || [];
    for (const hop of firstHop) {
      if (graph[hop]?.includes(target)) return 2;
    }
    return -1;
  }),
  calculateWoTMultiplier: jest.fn((target: string, anchor: string, graph: Record<string, string[]>) => {
    if (graph[anchor]?.includes(target)) return 0;
    const firstHop = graph[anchor] || [];
    for (const hop of firstHop) {
      if (graph[hop]?.includes(target)) return 0.62;
    }
    return 0;
  }),
  getWoTLabel: jest.fn((distance: number) => (distance < 0 ? 'unknown' : `${distance}-hop`)),
}));

import { PrimitiveWotService } from '../primitives/wot.service';

describe('PrimitiveWotService', () => {
  let service: PrimitiveWotService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PrimitiveWotService();
  });

  it('expands anchor first-hop graph and returns calculated score', async () => {
    querySyncMock
      .mockResolvedValueOnce([
        { pubkey: 'anchor', created_at: 100, tags: [['p', 'alice']] },
        { pubkey: 'target', created_at: 100, tags: [] },
      ])
      .mockResolvedValueOnce([
        { pubkey: 'alice', created_at: 100, tags: [['p', 'target']] },
      ])
      .mockResolvedValueOnce([{ pubkey: 'follower-1', tags: [] }]);

    const result = await service.getScore('target', 'anchor');

    expect(result.scoreState).toBe('calculated');
    expect(result.trustScore).toBe(62);
    expect(result.distance).toBe(2);
    expect(result.distanceLabel).toBe('2-hop');
    expect(result.rationale.firstHopSampleSize).toBe(1);
  });

  it('returns unknown score when no path exists in graph sample', async () => {
    querySyncMock
      .mockResolvedValueOnce([
        { pubkey: 'anchor', created_at: 100, tags: [['p', 'alice']] },
      ])
      .mockResolvedValueOnce([
        { pubkey: 'alice', created_at: 100, tags: [['p', 'bob']] },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.getScore('target', 'anchor');

    expect(result.scoreState).toBe('unknown');
    expect(result.trustScore).toBeNull();
    expect(result.distance).toBe(-1);
    expect(result.distanceLabel).toBe('unknown');
  });
});
