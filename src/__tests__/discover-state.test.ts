import { excludeFollowedDiscoverUsers, hydrateFollowerCount, optimisticFollowUpdate } from '../../frontend/src/lib/discoverState';

describe('discover state helpers', () => {
  test('excludeFollowedDiscoverUsers removes already-followed pubkeys', () => {
    const users = [
      { pubkey: 'a' },
      { pubkey: 'b' },
      { pubkey: 'c' },
    ];

    const result = excludeFollowedDiscoverUsers(users, ['b']);

    expect(result).toEqual([{ pubkey: 'a' }, { pubkey: 'c' }]);
  });

  test('optimisticFollowUpdate removes followed card immediately', () => {
    const cards = [
      { pubkey: 'x', followers: 10 },
      { pubkey: 'y', followers: 5 },
    ];

    const result = optimisticFollowUpdate(cards, 'x');

    expect(result).toEqual([{ pubkey: 'y', followers: 5 }]);
  });

  test('hydrateFollowerCount prefers backend follower_count fields when present', () => {
    const user = {
      pubkey: 'pk1',
      followers: 0,
      follower_count: 42,
      following: 0,
      following_count: 9,
      activity: 1,
      freshnessScore: 0,
      overlapScore: 0,
      secondHopCount: 0,
      wotFollowerCount: 0,
      proximityScore: 0,
      interactionScore: 0,
      relayAffinityScore: 0,
      forYouScore: 0,
      wotScore: 0,
      score: 0,
      verifiedNip05: false,
    };

    const hydrated = hydrateFollowerCount(user);

    expect(hydrated.followers).toBe(42);
    expect(hydrated.following).toBe(9);
  });
});
