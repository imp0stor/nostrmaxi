import { suggestedRelays } from '../../frontend/src/lib/discoverEntities';

describe('relay discovery recommendations', () => {
  test('excludes already configured relays', () => {
    const suggestions = suggestedRelays({
      configuredRelays: ['wss://relay.damus.io', 'wss://nos.lol'],
      userRegion: 'US',
      preferredTopics: ['social'],
      limit: 10,
    });

    expect(suggestions.some((relay) => relay.url === 'wss://relay.damus.io')).toBe(false);
    expect(suggestions.some((relay) => relay.url === 'wss://nos.lol')).toBe(false);
  });

  test('ranks by topic and region affinity', () => {
    const suggestions = suggestedRelays({
      configuredRelays: [],
      userRegion: 'US',
      preferredTopics: ['identity', 'profiles'],
      limit: 6,
    });

    expect(suggestions.length).toBeGreaterThan(0);
    const first = suggestions[0];
    expect(first.score).toBeGreaterThan(0.5);
    expect(first.reason.length).toBeGreaterThan(0);
    expect(first.stars).toBeGreaterThanOrEqual(1);
    expect(first.badges.length).toBeGreaterThan(0);
  });

  test('supports metric sort and filters', () => {
    const suggestions = suggestedRelays({
      configuredRelays: [],
      userRegion: 'EU',
      preferredTopics: ['social'],
      limit: 10,
      sortBy: 'uptime',
      filters: {
        pricing: 'free',
        nips: [11],
      },
    });

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((relay) => relay.metrics.feature.nips.includes(11))).toBe(true);
    expect(suggestions.every((relay) => relay.metrics.feature.paid === false)).toBe(true);
  });
});
