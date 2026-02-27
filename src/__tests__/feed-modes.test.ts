import { findNextCursor, interactionScoreForEvent, scoreWotEvent } from '../../frontend/src/lib/social';
import type { NostrEvent } from '../../frontend/src/types';

function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: overrides.id || `id-${Math.random().toString(16).slice(2)}`,
    pubkey: overrides.pubkey || 'a'.repeat(64),
    created_at: overrides.created_at ?? 1,
    kind: overrides.kind ?? 1,
    tags: overrides.tags ?? [],
    content: overrides.content ?? '',
    sig: overrides.sig || 'b'.repeat(128),
  };
}

describe('feed mode ranking + pagination helpers', () => {
  test('wot scoring prioritizes following then second-hop', () => {
    const followingSet = new Set(['followed']);
    const secondHopSet = new Set(['second']);

    expect(scoreWotEvent(makeEvent({ pubkey: 'followed' }), followingSet, secondHopSet)).toBe(2);
    expect(scoreWotEvent(makeEvent({ pubkey: 'second' }), followingSet, secondHopSet)).toBe(1);
    expect(scoreWotEvent(makeEvent({ pubkey: 'random' }), followingSet, secondHopSet)).toBe(0.25);
  });

  test('high-signal scoring weights zaps and interactions', () => {
    const event = makeEvent({ id: 'root', pubkey: 'author' });
    const interactions = [
      makeEvent({ kind: 7, tags: [['e', 'root']] }),
      makeEvent({ kind: 6, tags: [['e', 'root']] }),
      makeEvent({ kind: 9735, tags: [['e', 'root']] }),
      makeEvent({ kind: 1, tags: [['e', 'root']] }),
    ];

    expect(interactionScoreForEvent(event, interactions)).toBe(7);
  });

  test('next cursor is oldest timestamp - 1 for infinite scroll', () => {
    const items = [
      makeEvent({ created_at: 200 }),
      makeEvent({ created_at: 160 }),
      makeEvent({ created_at: 180 }),
    ];
    expect(findNextCursor(items)).toBe(159);
    expect(findNextCursor([])).toBeUndefined();
  });
});
