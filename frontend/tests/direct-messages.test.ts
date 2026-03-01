import { deriveConversationList, type DirectMessageItem } from '../src/lib/directMessages';
import type { NostrEvent } from '../src/types';

function dmEvent(partial: Partial<NostrEvent>): NostrEvent {
  return {
    id: partial.id || 'id',
    pubkey: partial.pubkey || 'a'.repeat(64),
    created_at: partial.created_at || 1,
    kind: 4,
    tags: partial.tags || [['p', 'b'.repeat(64)]],
    content: partial.content || 'cipher',
    sig: partial.sig || 'c'.repeat(128),
  };
}

function dmItem(partial: Partial<DirectMessageItem>): DirectMessageItem {
  return {
    id: partial.id || 'm1',
    event: partial.event || dmEvent({ id: partial.id || 'm1', pubkey: partial.fromPubkey, created_at: partial.createdAt }),
    fromPubkey: partial.fromPubkey || 'a'.repeat(64),
    toPubkey: partial.toPubkey || 'b'.repeat(64),
    counterpartyPubkey: partial.counterpartyPubkey || 'b'.repeat(64),
    createdAt: partial.createdAt || 1,
    ciphertext: partial.ciphertext || 'enc',
    plaintext: Object.prototype.hasOwnProperty.call(partial, 'plaintext') ? (partial.plaintext as string | null) : 'hello',
    encryption: partial.encryption || 'nip04',
    decryptionError: partial.decryptionError,
    outgoing: partial.outgoing ?? true,
  };
}

describe('direct message conversation helpers', () => {
  it('groups messages by counterparty and sorts latest first', () => {
    const alice = 'a'.repeat(64);
    const bob = 'b'.repeat(64);
    const carol = 'c'.repeat(64);

    const conversations = deriveConversationList([
      dmItem({ id: '1', counterpartyPubkey: bob, createdAt: 100, plaintext: 'older bob' }),
      dmItem({ id: '2', counterpartyPubkey: bob, createdAt: 200, plaintext: 'newer bob' }),
      dmItem({ id: '3', counterpartyPubkey: carol, createdAt: 150, plaintext: 'carol note', outgoing: false, fromPubkey: carol, toPubkey: alice }),
    ]);

    expect(conversations).toHaveLength(2);
    expect(conversations[0].counterpartyPubkey).toBe(bob);
    expect(conversations[0].lastMessagePreview).toBe('newer bob');
    expect(conversations[0].unreadCount).toBe(0);

    expect(conversations[1].counterpartyPubkey).toBe(carol);
    expect(conversations[1].unreadCount).toBe(1);
  });

  it('uses encrypted-message fallback preview when plaintext unavailable', () => {
    const conversations = deriveConversationList([
      dmItem({ id: 'x', counterpartyPubkey: 'd'.repeat(64), plaintext: null }),
    ]);

    expect(conversations[0].lastMessagePreview).toBe('Encrypted message');
  });
});
