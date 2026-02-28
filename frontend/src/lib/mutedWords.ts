import { SimplePool, finalizeEvent, getPublicKey, nip44, type Event as NostrEvent } from 'nostr-tools';

const MUTED_WORDS_D_TAG = 'muted-words';
const MUTED_WORDS_KIND = 30001;

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.primal.net'];

function normalizeWords(words: string[]): string[] {
  return [...new Set(words.map((w) => w.trim().toLowerCase()).filter(Boolean))];
}

function getConversationKey(privateKey: Uint8Array): Uint8Array {
  const pubkey = getPublicKey(privateKey);
  return nip44.v2.utils.getConversationKey(privateKey, pubkey);
}

// Encrypt muted words to self
export async function encryptMutedWords(words: string[], privateKey: Uint8Array): Promise<string> {
  const plaintext = JSON.stringify(normalizeWords(words));
  const conversationKey = getConversationKey(privateKey);
  return nip44.v2.encrypt(plaintext, conversationKey);
}

// Decrypt muted words from event
export async function decryptMutedWords(encryptedContent: string, privateKey: Uint8Array): Promise<string[]> {
  const conversationKey = getConversationKey(privateKey);
  const decrypted = nip44.v2.decrypt(encryptedContent, conversationKey);
  const parsed = JSON.parse(decrypted);
  return Array.isArray(parsed) ? normalizeWords(parsed.map((v) => String(v))) : [];
}

function latestMutedWordsEvent(events: NostrEvent[]): NostrEvent | null {
  if (events.length === 0) return null;
  return [...events].sort((a, b) => b.created_at - a.created_at)[0] || null;
}

// Fetch and decrypt muted words from relay
export async function loadMutedWords(pubkey: string, privateKey: Uint8Array, relays: string[] = DEFAULT_RELAYS): Promise<string[]> {
  const pool = new SimplePool();
  try {
    const events = await pool.querySync(relays, {
      kinds: [MUTED_WORDS_KIND],
      authors: [pubkey],
      '#d': [MUTED_WORDS_D_TAG],
      limit: 20,
    } as any);

    const event = latestMutedWordsEvent(events as NostrEvent[]);
    if (!event) return [];

    const encryptedTag = event.tags.find((t) => t[0] === 'encrypted' && t[1]);
    if (!encryptedTag) {
      const legacy = JSON.parse(event.content || '[]');
      return Array.isArray(legacy) ? normalizeWords(legacy.map((v) => String(v))) : [];
    }

    if (encryptedTag[1] !== 'nip44') {
      throw new Error(`Unsupported encryption method: ${encryptedTag[1]}`);
    }

    return decryptMutedWords(event.content, privateKey);
  } finally {
    pool.close(relays);
  }
}

// Save muted words (encrypt and publish)
export async function saveMutedWords(words: string[], privateKey: Uint8Array, relays: string[] = DEFAULT_RELAYS): Promise<void> {
  const pubkey = getPublicKey(privateKey);
  const encryptedContent = await encryptMutedWords(words, privateKey);

  const unsignedEvent = {
    kind: MUTED_WORDS_KIND,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', MUTED_WORDS_D_TAG],
      ['encrypted', 'nip44'],
    ],
    content: encryptedContent,
  };

  const signedEvent = finalizeEvent(unsignedEvent, privateKey);

  const pool = new SimplePool();
  try {
    const pubs = pool.publish(relays, signedEvent as any);
    await Promise.all(pubs as any);
  } finally {
    pool.close(relays);
  }
}

// If using NIP-46/remote signer, request encryption via bunker/NIP-07 bridge
export async function encryptWithBunker(plaintext: string, bunkerPubkey: string): Promise<string> {
  const nip44Api = (window as any)?.nostr?.nip44;
  if (!nip44Api || typeof nip44Api.encrypt !== 'function') {
    throw new Error('NIP-44 encryption not available in current signer');
  }
  return nip44Api.encrypt(bunkerPubkey, plaintext);
}

// Migrate legacy plaintext muted words to NIP-44-encrypted list
export async function migrateMutedWords(pubkey: string, privateKey: Uint8Array, relays: string[] = DEFAULT_RELAYS): Promise<void> {
  const pool = new SimplePool();
  try {
    const events = await pool.querySync(relays, {
      kinds: [MUTED_WORDS_KIND],
      authors: [pubkey],
      '#d': [MUTED_WORDS_D_TAG],
      limit: 20,
    } as any);

    const event = latestMutedWordsEvent(events as NostrEvent[]);
    if (!event) return;

    const isEncrypted = event.tags.some((t) => t[0] === 'encrypted' && t[1] === 'nip44');
    if (isEncrypted) return;

    const legacy = JSON.parse(event.content || '[]');
    const words = Array.isArray(legacy) ? legacy.map((v) => String(v)) : [];
    await saveMutedWords(words, privateKey, relays);
  } finally {
    pool.close(relays);
  }
}

export const mutedWordsListMeta = {
  kind: MUTED_WORDS_KIND,
  dTag: MUTED_WORDS_D_TAG,
};
