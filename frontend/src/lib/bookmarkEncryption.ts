import type { NostrEvent } from '../types';

export interface Bookmark {
  id: string;
  relay?: string;
  addedAt: number;
  note?: string;
  tags?: string[];
  folder?: string;
}

export interface BookmarkFolder {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

export interface BookmarkList {
  version: number;
  folders: BookmarkFolder[];
  bookmarks: Bookmark[];
}

export interface EncryptionResult {
  ciphertext: string;
  method: 'nip44' | 'nip04';
}

const CURRENT_VERSION = 1;

export const emptyBookmarkList = (): BookmarkList => ({
  version: CURRENT_VERSION,
  folders: [],
  bookmarks: [],
});

const normalize = (list: Partial<BookmarkList> | null | undefined): BookmarkList => {
  if (!list) return emptyBookmarkList();
  return {
    version: typeof list.version === 'number' ? list.version : CURRENT_VERSION,
    folders: Array.isArray(list.folders) ? list.folders : [],
    bookmarks: Array.isArray(list.bookmarks) ? list.bookmarks : [],
  };
};

export async function encryptBookmarkListToSelf(pubkey: string, list: BookmarkList): Promise<EncryptionResult> {
  const plaintext = JSON.stringify(normalize(list));
  const nip44 = (window?.nostr as any)?.nip44;
  if (nip44 && typeof nip44.encrypt === 'function') {
    const ciphertext = await nip44.encrypt(pubkey, plaintext);
    return { ciphertext, method: 'nip44' };
  }

  const nip04 = window?.nostr?.nip04;
  if (!nip04) throw new Error('No supported signer encryption API available (NIP-44/NIP-04).');
  const ciphertext = await nip04.encrypt(pubkey, plaintext);
  return { ciphertext, method: 'nip04' };
}

export async function decryptBookmarkListFromSelf(pubkey: string, ciphertext: string): Promise<BookmarkList> {
  const nip44 = (window?.nostr as any)?.nip44;
  if (nip44 && typeof nip44.decrypt === 'function') {
    const plaintext = await nip44.decrypt(pubkey, ciphertext);
    return normalize(JSON.parse(plaintext) as Partial<BookmarkList>);
  }

  const nip04 = window?.nostr?.nip04;
  if (!nip04) throw new Error('No supported signer decryption API available (NIP-44/NIP-04).');
  const plaintext = await nip04.decrypt(pubkey, ciphertext);
  return normalize(JSON.parse(plaintext) as Partial<BookmarkList>);
}

export function extractPublicBookmarks(event: NostrEvent): BookmarkList {
  const bookmarks: Bookmark[] = event.tags
    .filter((tag) => tag[0] === 'e' && tag[1])
    .map((tag, index) => ({
      id: tag[1],
      relay: tag[2],
      addedAt: event.created_at - index,
    }));

  return {
    version: CURRENT_VERSION,
    folders: [],
    bookmarks,
  };
}
