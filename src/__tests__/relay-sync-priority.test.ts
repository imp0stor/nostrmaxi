import { PriorityService } from '../relay-sync/priority.service';

describe('PriorityService', () => {
  const service = new PriorityService();
  const now = Math.floor(Date.now() / 1000);

  test('scores active high-follower zapped users highest', () => {
    const score = service.scoreUser({
      pubkey: 'a'.repeat(64),
      lastActive: now - 60,
      followerCount: 5_000,
      zapsSent: 1,
      zapsReceived: 4,
    });

    expect(score).toBe(200);
  });

  test('penalizes dormant and recently synced users', () => {
    const score = service.scoreUser({
      pubkey: 'b'.repeat(64),
      lastActive: now - 100 * 86_400,
      followerCount: 20,
      zapsSent: 0,
      zapsReceived: 0,
      syncedAt: now - 300,
    });

    expect(score).toBeLessThan(0);
    expect(score).toBe(-150);
  });
});
