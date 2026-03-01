import { RateLimiterService } from '../relay-sync/rate-limiter.service';

describe('RateLimiterService', () => {
  test('applies exponential backoff and decays target RPM on 429', () => {
    const limiter = new RateLimiterService();

    const before = limiter.getRateLimit('wss://nos.lol');
    const first = limiter.register429('wss://nos.lol');
    const second = limiter.register429('wss://nos.lol');

    expect(first).toBe(2_000);
    expect(second).toBe(4_000);
    expect(limiter.getRateLimit('wss://nos.lol')).toBeLessThan(before);
  });

  test('quarantines relay after repeated 429s', () => {
    const limiter = new RateLimiterService();

    limiter.register429('wss://relay.damus.io');
    limiter.register429('wss://relay.damus.io');
    limiter.register429('wss://relay.damus.io');

    const state = limiter.getState('wss://relay.damus.io');
    expect(state.quarantinedUntil).toBeGreaterThan(Date.now());
  });

  test('uses configured relay limits and defaults', () => {
    const limiter = new RateLimiterService();

    expect(limiter.getRateLimit('wss://relay.damus.io')).toBe(50);
    expect(limiter.getRateLimit('wss://relay.primal.net')).toBe(100);
    expect(limiter.getRateLimit('wss://nos.lol')).toBe(30);
    expect(limiter.getRateLimit('wss://unknown.example')).toBe(40);
  });

  test('orders relays by effective availability (health + backoff)', () => {
    const limiter = new RateLimiterService();

    limiter.register429('wss://relay.damus.io');
    limiter.register429('wss://relay.damus.io');
    limiter.register429('wss://relay.damus.io');

    const ordered = limiter.getOrderedRelays([
      'wss://relay.damus.io',
      'wss://relay.primal.net',
      'wss://nos.lol',
    ]);

    expect(ordered[0]).toBe('wss://relay.primal.net');
    expect(ordered[ordered.length - 1]).toBe('wss://relay.damus.io');
  });
});
