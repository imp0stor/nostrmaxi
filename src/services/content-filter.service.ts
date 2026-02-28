import { Injectable } from '@nestjs/common';
import type { Event as NostrEvent } from 'nostr-tools';

export interface UserContentFilters {
  mutedWords: string[];
  mutedPubkeys: string[];
  mutedThreads: string[];
  mutedHashtags: string[];
}

@Injectable()
export class ContentFilterService {
  shouldFilter(event: Pick<NostrEvent, 'id' | 'pubkey' | 'content' | 'tags'>, filters: UserContentFilters): boolean {
    const normalized = this.normalize(filters);

    if (normalized.mutedPubkeys.includes(event.pubkey)) return true;
    if (normalized.mutedThreads.includes(event.id)) return true;

    const threadRefs = (event.tags || []).filter((t) => t[0] === 'e' && t[1]).map((t) => t[1]);
    if (threadRefs.some((id) => normalized.mutedThreads.includes(id))) return true;

    const hashtags = this.extractHashtags(event);
    if (hashtags.some((tag) => normalized.mutedHashtags.includes(tag))) return true;

    const content = (event.content || '').toLowerCase();
    if (normalized.mutedWords.some((word) => content.includes(word))) return true;

    return false;
  }

  filterEvents<T extends Pick<NostrEvent, 'id' | 'pubkey' | 'content' | 'tags'>>(events: T[], filters: UserContentFilters): T[] {
    return events.filter((event) => !this.shouldFilter(event, filters));
  }

  private extractHashtags(event: Pick<NostrEvent, 'content' | 'tags'>): string[] {
    const fromTags = (event.tags || []).filter((t) => t[0] === 't' && t[1]).map((t) => t[1].toLowerCase());
    const fromContent = Array.from((event.content || '').matchAll(/#([a-z0-9_]+)/gi)).map((m) => m[1].toLowerCase());
    return [...new Set([...fromTags, ...fromContent])];
  }

  private normalize(filters: UserContentFilters): UserContentFilters {
    const uniq = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))];
    return {
      mutedWords: uniq(filters.mutedWords || []).map((v) => v.toLowerCase()),
      mutedPubkeys: uniq(filters.mutedPubkeys || []),
      mutedThreads: uniq(filters.mutedThreads || []),
      mutedHashtags: uniq(filters.mutedHashtags || []).map((v) => v.replace(/^#/, '').toLowerCase()),
    };
  }
}
