import { buildSimilarProfiles } from '../../frontend/src/lib/discoverEntities';

describe('discover ranking signals', () => {
  test('prioritizes proximity/interactions for similar profiles', () => {
    const cards = [
      { pubkey: 'a', overlapScore: 8, wotFollowerCount: 5, activity: 2, score: 0.4, followers: 0, following: 0, verifiedNip05: false },
      { pubkey: 'b', overlapScore: 0, wotFollowerCount: 0, activity: 3, score: 0.9, followers: 0, following: 0, verifiedNip05: false },
    ] as any;

    const out = buildSimilarProfiles(cards, [], 2);
    expect(out[0].pubkey).toBe('a');
  });
});
