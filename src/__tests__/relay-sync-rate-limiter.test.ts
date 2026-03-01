import { RateLimiterService } from '../relay-sync/rate-limiter.service';

describe('RateLimiterService', () => {
  test('applies exponential backoff on 429', () => {
    const limiter = new RateLimiterService();

    const first = limiter.register429('wss://nos.lol');
    const second = limiter.register429('wss://nos.lol');

    expect(first).toBe(2_000);
    expect(second).toBe(4_000);
  });

  test('uses configured relay limits', () => {
    const limiter = new RateLimiterService();

    expect(limiter.getRateLimit('wss://relay.damus.io')).toBe(50);
    expect(limiter.getRateLimit('wss://relay.primal.net')).toBe(100);
    expect(limiter.getRateLimit('wss://nos.lol')).toBe(30);
    expect(limiter.getRateLimit('wss://unknown.example')).toBe(40);
  });
});
