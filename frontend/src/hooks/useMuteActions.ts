import { useCallback } from 'react';
import { useContentFilters } from './useContentFilters';

export function useMuteActions(pubkey?: string) {
  const { filters, saveFilters } = useContentFilters(pubkey);

  const mutePubkey = useCallback(async (targetPubkey: string) => {
    if (filters.mutedPubkeys.includes(targetPubkey)) return;
    await saveFilters({
      ...filters,
      mutedPubkeys: [...filters.mutedPubkeys, targetPubkey],
    });
  }, [filters, saveFilters]);

  const unmutePubkey = useCallback(async (targetPubkey: string) => {
    await saveFilters({
      ...filters,
      mutedPubkeys: filters.mutedPubkeys.filter((p) => p !== targetPubkey),
    });
  }, [filters, saveFilters]);

  const muteWord = useCallback(async (word: string) => {
    const normalized = word.toLowerCase().trim();
    if (!normalized || filters.mutedWords.includes(normalized)) return;
    await saveFilters({
      ...filters,
      mutedWords: [...filters.mutedWords, normalized],
    });
  }, [filters, saveFilters]);

  const muteHashtag = useCallback(async (tag: string) => {
    const normalized = tag.replace(/^#/, '').toLowerCase().trim();
    if (!normalized || filters.mutedHashtags.includes(normalized)) return;
    await saveFilters({
      ...filters,
      mutedHashtags: [...filters.mutedHashtags, normalized],
    });
  }, [filters, saveFilters]);

  const muteThread = useCallback(async (eventId: string) => {
    if (filters.mutedThreads.includes(eventId)) return;
    await saveFilters({
      ...filters,
      mutedThreads: [...filters.mutedThreads, eventId],
    });
  }, [filters, saveFilters]);

  const isPubkeyMuted = useCallback((targetPubkey: string) => filters.mutedPubkeys.includes(targetPubkey), [filters]);

  const isHashtagMuted = useCallback((tag: string) => {
    const normalized = tag.replace(/^#/, '').toLowerCase().trim();
    return filters.mutedHashtags.includes(normalized);
  }, [filters]);

  return {
    mutePubkey,
    unmutePubkey,
    muteWord,
    muteHashtag,
    muteThread,
    isPubkeyMuted,
    isHashtagMuted,
    filters,
  };
}
