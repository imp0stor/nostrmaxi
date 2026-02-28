import { useCallback, useEffect, useMemo, useState } from 'react';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { publishEvent, signEvent } from '../lib/nostr';
import { SOCIAL_RELAYS } from '../lib/social';
import {
  decryptBookmarkListFromSelf,
  emptyBookmarkList,
  encryptBookmarkListToSelf,
  extractPublicBookmarks,
  type Bookmark,
  type BookmarkFolder,
  type BookmarkList,
} from '../lib/bookmarkEncryption';

const BOOKMARK_KIND = 10003;
const BOOKMARK_RELAYS = SOCIAL_RELAYS;

export function useBookmarks(pubkey?: string | null) {
  const [bookmarks, setBookmarks] = useState<BookmarkList>(emptyBookmarkList());
  const [isLoading, setIsLoading] = useState(true);
  const [isEncrypted, setIsEncrypted] = useState(true);
  const [encryptionMethod, setEncryptionMethod] = useState<'nip44' | 'nip04' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAndDecrypt = useCallback(async () => {
    if (!pubkey) {
      setBookmarks(emptyBookmarkList());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const pool = new SimplePool();
    try {
      const events = await pool.querySync(BOOKMARK_RELAYS, { kinds: [BOOKMARK_KIND], authors: [pubkey], limit: 30 });
      if (events.length === 0) {
        setBookmarks(emptyBookmarkList());
        setIsEncrypted(true);
        return;
      }

      const newest = events.sort((a, b) => b.created_at - a.created_at)[0] as NostrEvent;
      const encryptedMethod = newest.tags.find((t) => t[0] === 'encrypted')?.[1];
      const hasEncryptedContent = Boolean(newest.content && newest.content.trim().length > 0);

      if (hasEncryptedContent) {
        const list = await decryptBookmarkListFromSelf(pubkey, newest.content);
        setBookmarks(list);
        setIsEncrypted(true);
        setEncryptionMethod(encryptedMethod === 'nip44' ? 'nip44' : 'nip04');
      } else {
        setBookmarks(extractPublicBookmarks(newest as any));
        setIsEncrypted(false);
        setEncryptionMethod(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookmarks');
    } finally {
      pool.close(BOOKMARK_RELAYS);
      setIsLoading(false);
    }
  }, [pubkey]);

  const saveBookmarks = useCallback(async (nextList: BookmarkList, encrypted = isEncrypted) => {
    if (!pubkey) throw new Error('Missing pubkey');

    const sanitized: BookmarkList = {
      ...nextList,
      bookmarks: nextList.bookmarks
        .filter((item) => item.id)
        .sort((a, b) => b.addedAt - a.addedAt),
    };

    let content = '';
    let tags: string[][] = [];

    if (encrypted) {
      const encryptedPayload = await encryptBookmarkListToSelf(pubkey, sanitized);
      content = encryptedPayload.ciphertext;
      tags = [['encrypted', encryptedPayload.method], ['client', 'nostrmaxi']];
      setEncryptionMethod(encryptedPayload.method);
    } else {
      content = '';
      tags = sanitized.bookmarks.map((item) => ['e', item.id, item.relay || '']);
      setEncryptionMethod(null);
    }

    const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
      kind: BOOKMARK_KIND,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
    };

    const signed = await signEvent(unsigned);
    if (!signed) throw new Error('Signing failed');
    const result = await publishEvent(signed);
    if (!result?.success) throw new Error('Publish failed');

    setBookmarks(sanitized);
    setIsEncrypted(encrypted);
  }, [isEncrypted, pubkey]);

  const addBookmark = useCallback(async (eventId: string, options?: { folder?: string; note?: string; tags?: string[]; relay?: string }) => {
    const normalizedId = eventId.trim();
    if (!normalizedId) return;

    const now = Math.floor(Date.now() / 1000);
    const existing = bookmarks.bookmarks.find((item) => item.id === normalizedId);
    const updated: Bookmark = existing
      ? { ...existing, ...options }
      : {
        id: normalizedId,
        relay: options?.relay,
        folder: options?.folder,
        note: options?.note,
        tags: options?.tags,
        addedAt: now,
      };

    const next: BookmarkList = {
      ...bookmarks,
      bookmarks: [updated, ...bookmarks.bookmarks.filter((item) => item.id !== normalizedId)],
    };

    await saveBookmarks(next, isEncrypted);
  }, [bookmarks, isEncrypted, saveBookmarks]);

  const removeBookmark = useCallback(async (eventId: string) => {
    const next: BookmarkList = {
      ...bookmarks,
      bookmarks: bookmarks.bookmarks.filter((item) => item.id !== eventId),
    };
    await saveBookmarks(next, isEncrypted);
  }, [bookmarks, isEncrypted, saveBookmarks]);

  const createFolder = useCallback(async (name: string, icon?: string, color?: string) => {
    const folderName = name.trim();
    if (!folderName) throw new Error('Folder name required');

    const folder: BookmarkFolder = {
      id: `folder-${Date.now().toString(36)}`,
      name: folderName,
      icon,
      color,
    };

    const next = {
      ...bookmarks,
      folders: [...bookmarks.folders, folder],
    };
    await saveBookmarks(next, isEncrypted);
    return folder;
  }, [bookmarks, isEncrypted, saveBookmarks]);

  const moveToFolder = useCallback(async (eventId: string, folderId?: string) => {
    const next = {
      ...bookmarks,
      bookmarks: bookmarks.bookmarks.map((item) => item.id === eventId ? { ...item, folder: folderId } : item),
    };
    await saveBookmarks(next, isEncrypted);
  }, [bookmarks, isEncrypted, saveBookmarks]);

  const updateNote = useCallback(async (eventId: string, note: string) => {
    const next = {
      ...bookmarks,
      bookmarks: bookmarks.bookmarks.map((item) => item.id === eventId ? { ...item, note } : item),
    };
    await saveBookmarks(next, isEncrypted);
  }, [bookmarks, isEncrypted, saveBookmarks]);

  const setPrivacyMode = useCallback(async (encrypted: boolean) => {
    await saveBookmarks(bookmarks, encrypted);
  }, [bookmarks, saveBookmarks]);

  const isBookmarked = useCallback((eventId: string) => bookmarks.bookmarks.some((item) => item.id === eventId), [bookmarks.bookmarks]);

  useEffect(() => {
    void loadAndDecrypt();
  }, [loadAndDecrypt]);

  return useMemo(() => ({
    bookmarks,
    isLoading,
    isEncrypted,
    encryptionMethod,
    error,
    loadAndDecrypt,
    saveBookmarks,
    addBookmark,
    removeBookmark,
    createFolder,
    moveToFolder,
    updateNote,
    setPrivacyMode,
    isBookmarked,
  }), [
    bookmarks,
    isLoading,
    isEncrypted,
    encryptionMethod,
    error,
    loadAndDecrypt,
    saveBookmarks,
    addBookmark,
    removeBookmark,
    createFolder,
    moveToFolder,
    updateNote,
    setPrivacyMode,
    isBookmarked,
  ]);
}
