import { computeAnalyticsFromEvents } from '../src/lib/analytics';
import type { NostrEvent } from '../src/types';

function evt(partial: Partial<NostrEvent>): NostrEvent {
  return {
    id: partial.id || 'id',
    pubkey: partial.pubkey || 'pk',
    created_at: partial.created_at || Math.floor(Date.now() / 1000),
    kind: partial.kind || 1,
    tags: partial.tags || [],
    content: partial.content || '',
    sig: partial.sig || 'sig',
  };
}

describe('analytics compute', () => {
  it('respects provided scope and computes top posts', () => {
    const now = Math.floor(Date.now() / 1000);
    const post = evt({ id: 'post-1', pubkey: 'author', kind: 1, created_at: now - 1000, content: 'Hello #nostr' });
    const reaction = evt({ id: 'react-1', pubkey: 'fan', kind: 7, created_at: now - 900, tags: [['e', 'post-1']], content: '+' });
    const zap = evt({ id: 'zap-1', pubkey: 'fan2', kind: 9735, created_at: now - 850, tags: [['e', 'post-1']] });

    const result = computeAnalyticsFromEvents({
      pubkey: 'me',
      events: [post, reaction, zap],
      followers: ['a', 'b', 'c'],
      following: ['x', 'y'],
      scope: 'wot',
    });

    expect(result.scope).toBe('wot');
    expect(result.profile.topPosts.length).toBeGreaterThan(0);
    expect(result.profile.topPosts[0].id).toBe('post-1');
    expect(result.engagement.reactionsByType[0].type).toBe('+');
  });
});
