import { RelaySyncController } from '../relay-sync/relay-sync.controller';

describe('RelaySyncController', () => {
  const service = {
    getStatus: jest.fn().mockResolvedValue({ running: true }),
    getStats: jest.fn().mockResolvedValue({ total: 10 }),
    start: jest.fn().mockResolvedValue({ started: true }),
    pause: jest.fn().mockResolvedValue({ paused: true }),
    addPubkey: jest.fn().mockResolvedValue(undefined),
  };

  const controller = new RelaySyncController(service as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns status', async () => {
    await expect(controller.getStatus()).resolves.toEqual({ running: true });
  });

  test('pauses/resumes and queues pubkey', async () => {
    await expect(controller.start()).resolves.toEqual({ started: true });
    await expect(controller.pause()).resolves.toEqual({ paused: true });

    await expect(controller.addPubkey({ pubkey: 'abc' })).resolves.toEqual({
      queued: true,
      pubkey: 'abc',
    });

    expect(service.addPubkey).toHaveBeenCalledWith('abc');
  });
});
