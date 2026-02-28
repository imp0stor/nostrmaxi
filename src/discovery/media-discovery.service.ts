import { Injectable, Logger } from '@nestjs/common';
import { SimplePool, type Event } from 'nostr-tools';
import { PodcastIndexClient, type PodcastIndexPodcast } from './podcast-index.client';

export type CreatorType = 'podcast' | 'video' | 'article' | 'music' | 'all';

export interface ContentCreator {
  pubkey: string;
  profile: {
    name?: string;
    display_name?: string;
    about?: string;
    picture?: string;
    lud16?: string;
    website?: string;
    [key: string]: unknown;
  };
  contentType: Array<'podcast' | 'video' | 'article' | 'music'>;
  platforms: {
    nostr: boolean;
    rss?: string;
    youtube?: string;
    spotify?: string;
    fountain?: string;
    wavlake?: string;
    substack?: string;
    website?: string;
  };
  v4vEnabled: boolean;
  followerCount: number;
  recentContent: Event[];
  topics: string[];
}

@Injectable()
export class MediaDiscoveryService {
  private readonly logger = new Logger(MediaDiscoveryService.name);
  private readonly relays = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.nostr.band'];

  constructor(private readonly podcastIndexClient: PodcastIndexClient) {}

  async discoverCreators(filter: { type?: CreatorType; tags?: string[]; limit?: number }): Promise<ContentCreator[]> {
    const pool = new SimplePool();
    const limit = Math.min(Math.max(filter.limit || 30, 5), 100);

    try {
      const metadataEvents = await pool.querySync(this.relays, {
        kinds: [0],
        limit: limit * 2,
      });

      const pubkeys = Array.from(new Set(metadataEvents.map((event) => event.pubkey))).slice(0, limit * 2);
      const contentEvents = await pool.querySync(this.relays, {
        kinds: [1, 30023, 30078],
        authors: pubkeys,
        limit: limit * 10,
      });

      const byPubkey = new Map<string, Event[]>();
      for (const event of contentEvents) {
        const list = byPubkey.get(event.pubkey) || [];
        list.push(event);
        byPubkey.set(event.pubkey, list);
      }

      const creators: ContentCreator[] = metadataEvents
        .map((event) => {
          const profile = this.safeJsonParse(event.content);
          const recentContent = (byPubkey.get(event.pubkey) || []).sort((a, b) => b.created_at - a.created_at).slice(0, 10);
          return this.buildCreator(event.pubkey, profile, recentContent);
        })
        .filter((creator): creator is ContentCreator => Boolean(creator))
        .filter((creator) => this.matchesFilter(creator, filter))
        .slice(0, limit);

      return creators;
    } catch (error) {
      this.logger.warn(`Failed media discovery: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    } finally {
      pool.close(this.relays);
    }
  }

  async analyzeProfile(pubkey: string): Promise<ContentCreator | null> {
    const pool = new SimplePool();
    try {
      const metadata = await pool.get(this.relays, { kinds: [0], authors: [pubkey] });
      if (!metadata) return null;
      const recentContent = await pool.querySync(this.relays, {
        kinds: [1, 30023, 30078],
        authors: [pubkey],
        limit: 20,
      });
      return this.buildCreator(pubkey, this.safeJsonParse(metadata.content), recentContent);
    } catch {
      return null;
    } finally {
      pool.close(this.relays);
    }
  }

  async searchPodcastIndex(query: string): Promise<PodcastIndexPodcast[]> {
    return this.podcastIndexClient.searchPodcasts(query);
  }

  async getNostrPodcasts(limit = 30): Promise<ContentCreator[]> {
    const creators = await this.discoverCreators({ type: 'podcast', limit });
    return creators.filter((creator) => creator.v4vEnabled || Boolean(creator.platforms.rss));
  }

  private buildCreator(pubkey: string, profile: Record<string, unknown>, recentContent: Event[]): ContentCreator | null {
    const about = String(profile.about || '').toLowerCase();
    const website = String(profile.website || '');
    const contentType = this.detectContentTypes(profile, recentContent);

    if (contentType.length === 0) return null;

    const platforms = this.detectPlatforms(profile);
    const topics = this.extractTopics(recentContent, String(profile.about || ''));

    return {
      pubkey,
      profile: profile as ContentCreator['profile'],
      contentType,
      platforms: {
        ...platforms,
        website: website || undefined,
      },
      v4vEnabled: typeof profile.lud16 === 'string' && profile.lud16.includes('@'),
      followerCount: 0,
      recentContent,
      topics,
    };
  }

  private detectContentTypes(profile: Record<string, unknown>, events: Event[]): Array<'podcast' | 'video' | 'article' | 'music'> {
    const types = new Set<'podcast' | 'video' | 'article' | 'music'>();
    const about = String(profile.about || '').toLowerCase();

    if (about.includes('podcast') || events.some((event) => event.kind === 30078)) types.add('podcast');
    if (about.includes('video') || events.some((event) => /(youtube|youtu\.be|vimeo|twitch)/i.test(event.content || ''))) types.add('video');
    if (about.includes('article') || events.some((event) => event.kind === 30023)) types.add('article');
    if (about.includes('music') || events.some((event) => /(spotify|soundcloud|wavlake|bandcamp)/i.test(event.content || ''))) types.add('music');

    return Array.from(types);
  }

  private detectPlatforms(profile: Record<string, unknown>) {
    const text = JSON.stringify(profile).toLowerCase();
    return {
      nostr: true,
      rss: this.extractUrl(text, /(https?:\/\/[^\s"']+\.xml)/i),
      youtube: this.extractUrl(text, /(https?:\/\/(www\.)?(youtube\.com|youtu\.be)[^\s"']*)/i),
      spotify: this.extractUrl(text, /(https?:\/\/open\.spotify\.com[^\s"']*)/i),
      fountain: this.extractUrl(text, /(https?:\/\/[^\s"']*fountain\.fm[^\s"']*)/i),
      wavlake: this.extractUrl(text, /(https?:\/\/[^\s"']*wavlake\.com[^\s"']*)/i),
      substack: this.extractUrl(text, /(https?:\/\/[^\s"']*substack\.com[^\s"']*)/i),
    };
  }

  private extractTopics(events: Event[], about: string): string[] {
    const set = new Set<string>();
    for (const event of events) {
      for (const tag of event.tags || []) {
        if (tag[0] === 't' && tag[1]) set.add(tag[1].toLowerCase());
      }
    }

    const aboutTags = about.match(/#[a-z0-9_]+/gi) || [];
    for (const tag of aboutTags) set.add(tag.slice(1).toLowerCase());

    return Array.from(set).slice(0, 20);
  }

  private matchesFilter(creator: ContentCreator, filter: { type?: CreatorType; tags?: string[] }): boolean {
    if (filter.type && filter.type !== 'all' && !creator.contentType.includes(filter.type as 'podcast' | 'video' | 'article' | 'music')) return false;

    if (filter.tags && filter.tags.length > 0) {
      const selected = filter.tags.map((tag) => tag.toLowerCase());
      const topicSet = new Set(creator.topics.map((tag) => tag.toLowerCase()));
      if (!selected.some((tag) => topicSet.has(tag))) return false;
    }

    return true;
  }

  private extractUrl(value: string, regex: RegExp): string | undefined {
    const match = value.match(regex);
    return match?.[1] || match?.[0] || undefined;
  }

  private safeJsonParse(value: string): Record<string, unknown> {
    try {
      return JSON.parse(value || '{}') as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
