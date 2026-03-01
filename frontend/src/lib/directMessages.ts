import { SimplePool, finalizeEvent, nip04 } from 'nostr-tools';
import type { NostrEvent } from '../types';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.primal.net',
];

export interface DirectMessageItem {
  id: string;
  event: NostrEvent;
  fromPubkey: string;
  toPubkey: string;
  counterpartyPubkey: string;
  createdAt: number;
  ciphertext: string;
  plaintext: string | null;
  decryptionError?: string;
  outgoing: boolean;
}

export interface DMConversation {
  counterpartyPubkey: string;
  lastMessageAt: number;
  unreadCount: number;
  lastMessagePreview: string;
  messages: DirectMessageItem[];
}

function getPTag(event: NostrEvent): string | null {
  return event.tags.find((tag) => tag[0] === 'p' && tag[1])?.[1] || null;
}

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'unknown error');
}

function previewText(plaintext: string | null, fallback = 'Encrypted message'): string {
  if (!plaintext || !plaintext.trim()) return fallback;
  return plaintext.replace(/\s+/g, ' ').trim().slice(0, 120);
}

function sortByDateAsc(a: DirectMessageItem, b: DirectMessageItem): number {
  return a.createdAt - b.createdAt;
}

export function deriveConversationList(items: DirectMessageItem[]): DMConversation[] {
  const byCounterparty = new Map<string, DirectMessageItem[]>();
  for (const item of items) {
    const list = byCounterparty.get(item.counterpartyPubkey) || [];
    list.push(item);
    byCounterparty.set(item.counterpartyPubkey, list);
  }

  return [...byCounterparty.entries()]
    .map(([counterpartyPubkey, messages]) => {
      const sorted = [...messages].sort(sortByDateAsc);
      const last = sorted[sorted.length - 1];
      const unreadCount = sorted.filter((msg) => !msg.outgoing).length;
      return {
        counterpartyPubkey,
        lastMessageAt: last?.createdAt || 0,
        unreadCount,
        lastMessagePreview: previewText(last?.plaintext || null),
        messages: sorted,
      } satisfies DMConversation;
    })
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

async function decryptContent(params: {
  event: NostrEvent;
  mePubkey: string;
  myPrivateKeyHex?: string | null;
  nip04Decrypt?: (pubkey: string, ciphertext: string) => Promise<string>;
}): Promise<{ plaintext: string | null; error?: string }> {
  const targetPubkey = params.event.pubkey === params.mePubkey
    ? getPTag(params.event)
    : params.event.pubkey;

  if (!targetPubkey) {
    return { plaintext: null, error: 'Missing p-tag target for DM event' };
  }

  try {
    if (params.myPrivateKeyHex) {
      const plaintext = await nip04.decrypt(params.myPrivateKeyHex, targetPubkey, params.event.content);
      return { plaintext };
    }

    if (params.nip04Decrypt) {
      const plaintext = await params.nip04Decrypt(targetPubkey, params.event.content);
      return { plaintext };
    }

    return { plaintext: null, error: 'No decrypt capability available (NIP-04 unavailable)' };
  } catch (error) {
    return { plaintext: null, error: normalizeError(error) };
  }
}

export async function loadDirectMessages(params: {
  mePubkey: string;
  relays?: string[];
  myPrivateKeyHex?: string | null;
  nip04Decrypt?: (pubkey: string, ciphertext: string) => Promise<string>;
  limit?: number;
}): Promise<DirectMessageItem[]> {
  const relays = params.relays || DEFAULT_RELAYS;
  const limit = Math.min(500, Math.max(20, params.limit ?? 200));
  const pool = new SimplePool();

  try {
    const events = await pool.querySync(relays, {
      kinds: [4],
      authors: [params.mePubkey],
      '#p': [params.mePubkey],
      limit,
    } as any);

    const unique = new Map<string, NostrEvent>();
    for (const event of events) {
      if (!event?.id || unique.has(event.id)) continue;
      unique.set(event.id, event as NostrEvent);
    }

    const messages: DirectMessageItem[] = [];
    for (const event of unique.values()) {
      const toPubkey = getPTag(event) || '';
      const fromPubkey = event.pubkey;
      const outgoing = fromPubkey === params.mePubkey;
      const counterpartyPubkey = outgoing ? toPubkey : fromPubkey;
      if (!counterpartyPubkey) continue;

      const decrypted = await decryptContent({
        event,
        mePubkey: params.mePubkey,
        myPrivateKeyHex: params.myPrivateKeyHex,
        nip04Decrypt: params.nip04Decrypt,
      });

      messages.push({
        id: event.id,
        event,
        fromPubkey,
        toPubkey,
        counterpartyPubkey,
        createdAt: event.created_at,
        ciphertext: event.content,
        plaintext: decrypted.plaintext,
        decryptionError: decrypted.error,
        outgoing,
      });
    }

    return messages.sort(sortByDateAsc);
  } finally {
    pool.close(relays);
  }
}

export async function sendDirectMessage(params: {
  senderPubkey: string;
  recipientPubkey: string;
  message: string;
  signEventFn?: (event: Omit<NostrEvent, 'id' | 'sig'>) => Promise<NostrEvent | null>;
  myPrivateKeyHex?: string | null;
  nip04Encrypt?: (pubkey: string, plaintext: string) => Promise<string>;
  relays?: string[];
}): Promise<{ event: NostrEvent; relays: string[] }> {
  const relays = params.relays || DEFAULT_RELAYS;
  const body = params.message.trim();
  if (!body) throw new Error('Message cannot be empty');
  if (!params.recipientPubkey) throw new Error('Recipient pubkey is required');

  let ciphertext = '';
  if (params.myPrivateKeyHex) {
    ciphertext = await nip04.encrypt(params.myPrivateKeyHex, params.recipientPubkey, body);
  } else if (params.nip04Encrypt) {
    ciphertext = await params.nip04Encrypt(params.recipientPubkey, body);
  } else {
    throw new Error('No encryption capability available (NIP-04 unavailable)');
  }

  const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
    kind: 4,
    content: ciphertext,
    tags: [['p', params.recipientPubkey]],
    pubkey: params.senderPubkey,
    created_at: Math.floor(Date.now() / 1000),
  };

  let signed: NostrEvent | null = null;
  if (params.myPrivateKeyHex) {
    const keyBytes = Uint8Array.from(params.myPrivateKeyHex.match(/.{1,2}/g)?.map((b) => Number.parseInt(b, 16)) || []);
    if (keyBytes.length !== 32) throw new Error('Invalid private key for DM signing');
    signed = finalizeEvent(unsigned, keyBytes) as NostrEvent;
  } else if (params.signEventFn) {
    signed = await params.signEventFn(unsigned);
  }

  if (!signed) throw new Error('Failed to sign DM event');

  const pool = new SimplePool();
  const successRelays: string[] = [];
  try {
    await Promise.allSettled(relays.map(async (relay) => {
      try {
        await pool.publish([relay], signed as NostrEvent);
        successRelays.push(relay);
      } catch {
        // best effort across relays
      }
    }));
  } finally {
    pool.close(relays);
  }

  if (!successRelays.length) {
    throw new Error('Failed to publish DM to relays');
  }

  return { event: signed, relays: successRelays };
}
