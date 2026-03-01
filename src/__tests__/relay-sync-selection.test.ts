import { RelaySyncService } from '../relay-sync/relay-sync.service';

describe('RelaySyncService relay selection', () => {
  test('applies adaptive limiter ordering after composing relay candidates', async () => {
    const ordered = ['wss://user-1.example', 'wss://relay.primal.net', 'wss://relay.damus.io'];

    const config = { get: jest.fn().mockReturnValue(undefined) } as any;
    const prisma = {
      discoveredRelay: {
        findMany: jest.fn().mockResolvedValue([
          { url: 'wss://relay.damus.io' },
          { url: 'wss://relay.primal.net' },
        ]),
      },
    } as any;
    const priority = { buildPriority: jest.fn() } as any;
    const rateLimiter = {
      getOrderedRelays: jest.fn().mockReturnValue(ordered),
      getRelayDebugStates: jest.fn().mockReturnValue([]),
    } as any;

    const service = new RelaySyncService(config, prisma, priority, rateLimiter);
    jest.spyOn(service as any, 'loadUserRelayList').mockResolvedValue(['wss://user-1.example']);

    const selected = await (service as any).selectRelaysForUser('pubkey123');

    expect(rateLimiter.getOrderedRelays).toHaveBeenCalledTimes(1);
    expect(selected.slice(0, 3)).toEqual(ordered);
  });
});
