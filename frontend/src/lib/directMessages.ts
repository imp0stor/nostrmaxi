import { SimplePool, finalizeEvent, nip04, nip44, nip59 } from 'nostr-tools';
import type { NostrEvent } from '../types';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.primal.net',
];

export type DMEncryption = 'nip44' | 'nip04' | 'unencrypted';

export interface DirectMessageItem {
  id: string;
  event: NostrEvent;
  fromPubkey: string;
  toPubkey: string;
  counterpartyPubkey: string;
  createdAt: number;
  ciphertext: string;
  plaintext: string | null;
  encryption: DMEncryption;
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

function hexToBytes(hex: string): Uint8Array {
  const parts = hex.match(/.{1,2}/g)?.map((b) => Number.parseInt(b, 16)) || [];
  return Uint8Array.from(parts);
}

function guessLegacyUnencrypted(content: string): boolean {
  // NIP-04 ciphertext is base64 with an ?iv= suffix. If that's absent, treat as legacy/plaintext fallback.
  return !content.includes('?iv=');
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
      const fallback = last?.encryption === 'unencrypted' ? 'Unencrypted message' : 'Encrypted message';
      return {
        counterpartyPubkey,
        lastMessageAt: last?.createdAt || 0,
        unreadCount,
        lastMessagePreview: previewText(last?.plaintext || null, fallback),
        messages: sorted,
      } satisfies DMConversation;
    })
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

async function decryptKind4(params: {
  event: NostrEvent;
  mePubkey: string;
  myPrivateKeyHex?: string | null;
  nip04Decrypt?: (pubkey: string, ciphertext: string) => Promise<string>;
}): Promise<{ plaintext: string | null; error?: string; encryption: DMEncryption }> {
  const targetPubkey = params.event.pubkey === params.mePubkey
    ? getPTag(params.event)
    : params.event.pubkey;

  if (!targetPubkey) {
    return { plaintext: null, error: 'Missing p-tag target for kind:4 DM event', encryption: 'nip04' };
  }

  if (guessLegacyUnencrypted(params.event.content)) {
    return { plaintext: params.event.content, encryption: 'unencrypted' };
  }

  try {
    if (params.myPrivateKeyHex) {
      const plaintext = await nip04.decrypt(params.myPrivateKeyHex, targetPubkey, params.event.content);
      return { plaintext, encryption: 'nip04' };
    }

    if (params.nip04Decrypt) {
      const plaintext = await params.nip04Decrypt(targetPubkey, params.event.content);
      return { plaintext, encryption: 'nip04' };
    }

    return { plaintext: null, error: 'No decrypt capability available (NIP-04 unavailable)', encryption: 'nip04' };
  } catch (error) {
    return { plaintext: null, error: normalizeError(error), encryption: 'nip04' };
  }
}

async function decryptKind14(params: {
  event: NostrEvent;
  mePubkey: string;
  myPrivateKeyHex?: string | null;
  nip44Decrypt?: (pubkey: string, ciphertext: string) => Promise<string>;
}): Promise<{ plaintext: string | null; error?: string; encryption: DMEncryption }> {
  const targetPubkey = params.event.pubkey === params.mePubkey
    ? getPTag(params.event)
    : params.event.pubkey;

  if (!targetPubkey) {
    return { plaintext: null, error: 'Missing p-tag target for kind:14 DM event', encryption: 'nip44' };
  }

  try {
    if (params.myPrivateKeyHex) {
      const key = nip44.getConversationKey(hexToBytes(params.myPrivateKeyHex), targetPubkey);
      const plaintext = nip44.decrypt(params.event.content, key);
      return { plaintext, encryption: 'nip44' };
    }

    if (params.nip44Decrypt) {
      const plaintext = await params.nip44Decrypt(targetPubkey, params.event.content);
      return { plaintext, encryption: 'nip44' };
    }

    return { plaintext: null, error: 'No decrypt capability available (NIP-44 unavailable)', encryption: 'nip44' };
  } catch (error) {
    return { plaintext: null, error: normalizeError(error), encryption: 'nip44' };
  }
}

function maybeNostrEvent(value: unknown): NostrEvent | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as NostrEvent;
  if (!candidate.pubkey || typeof candidate.kind !== 'number' || !Array.isArray(candidate.tags)) return null;
  if (typeof candidate.created_at !== 'number' || typeof candidate.content !== 'string') return null;
  return candidate;
}

export async function loadDirectMessages(params: {
  mePubkey: string;
  relays?: string[];
  myPrivateKeyHex?: string | null;
  nip04Decrypt?: (pubkey: string, ciphertext: string) => Promise<string>;
  nip44Decrypt?: (pubkey: string, ciphertext: string) => Promise<string>;
  limit?: number;
}): Promise<DirectMessageItem[]> {
  const relays = params.relays || DEFAULT_RELAYS;
  const limit = Math.min(500, Math.max(20, params.limit ?? 250));
  const pool = new SimplePool();

  try {
    const [incomingLegacyAndNip04, outgoingNip04, incomingNip44Kind14, outgoingNip44Kind14, giftWrap1059] = await Promise.all([
      pool.querySync(relays, { kinds: [4], '#p': [params.mePubkey], limit } as any),
      pool.querySync(relays, { kinds: [4], authors: [params.mePubkey], limit } as any),
      pool.querySync(relays, { kinds: [14], '#p': [params.mePubkey], limit } as any),
      pool.querySync(relays, { kinds: [14], authors: [params.mePubkey], limit } as any),
      pool.querySync(relays, { kinds: [1059], limit } as any),
    ]);

    const unique = new Map<string, NostrEvent>();
    for (const event of [...incomingLegacyAndNip04, ...outgoingNip04, ...incomingNip44Kind14, ...outgoingNip44Kind14, ...giftWrap1059]) {
      if (!event?.id || unique.has(event.id)) continue;
      unique.set(event.id, event as NostrEvent);
    }

    const messages: DirectMessageItem[] = [];
    for (const event of unique.values()) {
      if (event.kind === 4) {
        const toPubkey = getPTag(event) || '';
        const fromPubkey = event.pubkey;
        const outgoing = fromPubkey === params.mePubkey;
        const counterpartyPubkey = outgoing ? toPubkey : fromPubkey;
        if (!counterpartyPubkey) continue;

        const decrypted = await decryptKind4({
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
          encryption: decrypted.encryption,
          decryptionError: decrypted.error,
          outgoing,
        });
        continue;
      }

      if (event.kind === 14) {
        const toPubkey = getPTag(event) || '';
        const fromPubkey = event.pubkey;
        const outgoing = fromPubkey === params.mePubkey;
        const counterpartyPubkey = outgoing ? toPubkey : fromPubkey;
        if (!counterpartyPubkey) continue;

        const decrypted = await decryptKind14({
          event,
          mePubkey: params.mePubkey,
          myPrivateKeyHex: params.myPrivateKeyHex,
          nip44Decrypt: params.nip44Decrypt,
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
          encryption: 'nip44',
          decryptionError: decrypted.error,
          outgoing,
        });
        continue;
      }

      if (event.kind === 1059) {
        if (!params.myPrivateKeyHex) continue;
        try {
          const rumor = maybeNostrEvent(nip59.unwrapEvent(event as any, hexToBytes(params.myPrivateKeyHex)) as unknown);
          if (!rumor || rumor.kind !== 14) continue;

          const toPubkey = getPTag(rumor) || '';
          const fromPubkey = rumor.pubkey;
          const outgoing = fromPubkey === params.mePubkey;
          const counterpartyPubkey = outgoing ? toPubkey : fromPubkey;
          if (!counterpartyPubkey) continue;

          messages.push({
            id: `${event.id}:inner14`,
            event,
            fromPubkey,
            toPubkey,
            counterpartyPubkey,
            createdAt: rumor.created_at,
            ciphertext: event.content,
            plaintext: rumor.content,
            encryption: 'nip44',
            outgoing,
          });
        } catch {
          // Gift wrap wasn't for us (or malformed). Ignore.
        }
      }
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
  encryption?: DMEncryption;
  signEventFn?: (event: Omit<NostrEvent, 'id' | 'sig'>) => Promise<NostrEvent | null>;
  myPrivateKeyHex?: string | null;
  nip04Encrypt?: (pubkey: string, plaintext: string) => Promise<string>;
  relays?: string[];
}): Promise<{ event: NostrEvent; relays: string[]; encryption: DMEncryption }> {
  const relays = params.relays || DEFAULT_RELAYS;
  const body = params.message.trim();
  const encryption = params.encryption ?? 'nip44';

  if (!body) throw new Error('Message cannot be empty');
  if (!params.recipientPubkey) throw new Error('Recipient pubkey is required');

  let signed: NostrEvent | null = null;

  if (encryption === 'nip44') {
    if (!params.myPrivateKeyHex) {
      throw new Error('NIP-44 gift-wrap send requires a local nsec/private key in this session. Use NIP-04 fallback if unavailable.');
    }

    const keyBytes = hexToBytes(params.myPrivateKeyHex);
    if (keyBytes.length !== 32) throw new Error('Invalid private key for NIP-44 gift-wrap signing');

    const inner: Omit<NostrEvent, 'id' | 'sig'> = {
      kind: 14,
      content: body,
      tags: [['p', params.recipientPubkey]],
      pubkey: params.senderPubkey,
      created_at: Math.floor(Date.now() / 1000),
    };

    signed = nip59.wrapEvent(inner, keyBytes, params.recipientPubkey) as unknown as NostrEvent;
  } else {
    const unsignedBase: Omit<NostrEvent, 'id' | 'sig'> = {
      kind: 4,
      content: body,
      tags: [['p', params.recipientPubkey]],
      pubkey: params.senderPubkey,
      created_at: Math.floor(Date.now() / 1000),
    };

    if (encryption === 'nip04') {
      if (params.myPrivateKeyHex) {
        unsignedBase.content = await nip04.encrypt(params.myPrivateKeyHex, params.recipientPubkey, body);
      } else if (params.nip04Encrypt) {
        unsignedBase.content = await params.nip04Encrypt(params.recipientPubkey, body);
      } else {
        throw new Error('No encryption capability available (NIP-04 unavailable)');
      }
    }

    if (params.myPrivateKeyHex) {
      const keyBytes = hexToBytes(params.myPrivateKeyHex);
      if (keyBytes.length !== 32) throw new Error('Invalid private key for DM signing');
      signed = finalizeEvent(unsignedBase, keyBytes) as NostrEvent;
    } else if (params.signEventFn) {
      signed = await params.signEventFn(unsignedBase);
    }
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

  return { event: signed, relays: successRelays, encryption };
}
