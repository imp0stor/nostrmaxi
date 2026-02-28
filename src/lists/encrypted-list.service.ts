import { Injectable, Logger } from '@nestjs/common';
import { SimplePool, getPublicKey, nip44, type Event as NostrEvent } from 'nostr-tools';

const LOCAL_RELAY = 'ws://127.0.0.1:7777';
const MUTED_WORDS_D_TAG = 'muted-words';
const MUTED_WORDS_KIND = 30001;

function hexToBytes(hex: string): Uint8Array {
  if (!/^[a-f0-9]{64}$/i.test(hex)) {
    throw new Error('Expected 32-byte private key in hex format');
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

@Injectable()
export class EncryptedListService {
  private readonly logger = new Logger(EncryptedListService.name);
  private readonly pool = new SimplePool();

  async getMutedWords(pubkey: string, privateKey: string): Promise<string[]> {
    const events = await this.pool.querySync([LOCAL_RELAY], {
      kinds: [MUTED_WORDS_KIND],
      authors: [pubkey],
      '#d': [MUTED_WORDS_D_TAG],
      limit: 20,
    } as any);

    if (!events || events.length === 0) return [];

    const latest = [...(events as NostrEvent[])].sort((a, b) => b.created_at - a.created_at)[0];
    const encryptedTag = latest.tags.find((tag) => tag[0] === 'encrypted' && tag[1]);

    if (!encryptedTag || encryptedTag[1] !== 'nip44') {
      this.logger.warn(`Muted words event for ${pubkey} is not NIP-44 encrypted.`);
      try {
        const parsed = JSON.parse(latest.content || '[]');
        return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
      } catch {
        return [];
      }
    }

    const secret = hexToBytes(privateKey);
    const selfPubkey = getPublicKey(secret);
    const conversationKey = nip44.v2.utils.getConversationKey(secret, selfPubkey);
    const decrypted = nip44.v2.decrypt(latest.content, conversationKey);
    const parsed = JSON.parse(decrypted);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  }

  createMutedWordsEvent(
    pubkey: string,
    _words: string[],
    encryptedContent: string,
  ): Omit<NostrEvent, 'id' | 'sig'> {
    return {
      kind: MUTED_WORDS_KIND,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', MUTED_WORDS_D_TAG],
        ['encrypted', 'nip44'],
      ],
      content: encryptedContent,
    };
  }
}
