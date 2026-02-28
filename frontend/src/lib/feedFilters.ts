import type { NostrEvent } from '../types';

export function applyMutedWordsFilter(events: NostrEvent[], mutedWords: string[]): NostrEvent[] {
  if (mutedWords.length === 0) return events;

  const lowerWords = mutedWords.map((w) => w.toLowerCase()).filter(Boolean);
  if (lowerWords.length === 0) return events;

  return events.filter((event) => {
    const content = (event.content || '').toLowerCase();
    return !lowerWords.some((word) => content.includes(word));
  });
}
