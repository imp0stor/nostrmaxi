import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NostrService } from '../nostr/nostr.service';
import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * Show metadata (kind 31900)
 */
export interface Show {
  id: string;
  pubkey: string;
  name: string;
  description: string;
  image?: string;
  feedUrl?: string;
  authors: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Episode metadata (kind 31901)
 */
export interface Episode {
  id: string;
  showId: string;
  pubkey: string;
  title: string;
  summary: string;
  content: string;
  image?: string;
  duration?: number;
  fileUrl?: string;
  contentType?: string; // audio/video
  createdAt: number;
  updatedAt: number;
}

/**
 * Content aggregation service
 * Fetches and aggregates content from all primitives (episodes, shows, notes, etc.)
 */
@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(private nostr: NostrService) {}

  /**
   * Get show by ID
   */
  async getShow(showId: string): Promise<Show> {
    const events = await this.nostr.queryEvents(
      {
        ids: [showId],
        kinds: [31900 as any],
      },
      5000,
    );

    if (events.length === 0) {
      throw new NotFoundException(`Show not found: ${showId}`);
    }

    return this.parseShowEvent(events[0]);
  }

  /**
   * Get all shows from authors
   */
  async getShowsByAuthors(authors: string[]): Promise<Show[]> {
    const events = await this.nostr.queryEvents(
      {
        kinds: [31900 as any],
        authors,
        limit: 100,
      },
      5000,
    );

    return events.map((e) => this.parseShowEvent(e));
  }

  /**
   * Get shows paginated
   */
  async listShows(limit = 20, offset = 0): Promise<{ shows: Show[]; total: number }> {
    const events = await this.nostr.queryEvents(
      {
        kinds: [31900 as any],
        limit: limit + offset,
      },
      5000,
    );

    const shows = events.slice(offset, offset + limit).map((e) => this.parseShowEvent(e));

    return {
      shows,
      total: events.length,
    };
  }

  /**
   * Get episode by ID
   */
  async getEpisode(episodeId: string): Promise<Episode> {
    const events = await this.nostr.queryEvents(
      {
        ids: [episodeId],
        kinds: [31901 as any],
      },
      5000,
    );

    if (events.length === 0) {
      throw new NotFoundException(`Episode not found: ${episodeId}`);
    }

    return this.parseEpisodeEvent(events[0]);
  }

  /**
   * Get episodes for a show
   */
  async getShowEpisodes(showId: string, limit = 20, offset = 0): Promise<{ episodes: Episode[]; total: number }> {
    const events = await this.nostr.queryEvents(
      {
        kinds: [31901 as any],
        '#a': [showId], // Reference to show
        limit: limit + offset,
      },
      5000,
    );

    const episodes = events.slice(offset, offset + limit).map((e) => this.parseEpisodeEvent(e));

    return {
      episodes,
      total: events.length,
    };
  }

  /**
   * Get episodes from authors
   */
  async getEpisodesByAuthors(authors: string[], limit = 20): Promise<Episode[]> {
    const events = await this.nostr.queryEvents(
      {
        kinds: [31901 as any],
        authors,
        limit,
      },
      5000,
    );

    return events.map((e) => this.parseEpisodeEvent(e));
  }

  /**
   * List episodes paginated
   */
  async listEpisodes(limit = 20, offset = 0): Promise<{ episodes: Episode[]; total: number }> {
    const events = await this.nostr.queryEvents(
      {
        kinds: [31901 as any],
        limit: limit + offset,
      },
      5000,
    );

    const episodes = events.slice(offset, offset + limit).map((e) => this.parseEpisodeEvent(e));

    return {
      episodes,
      total: events.length,
    };
  }

  /**
   * Search content (notes, articles, etc.)
   */
  async searchNotes(query: string, limit = 20): Promise<any[]> {
    // NDK provides full-text search on relays that support it
    // For MVP, fetch recent notes and filter locally
    const events = await this.nostr.queryEvents(
      {
        kinds: [1],
        limit: 100,
      },
      5000,
    );

    return events
      .filter((e) => e.content.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit)
      .map((e) => ({
        id: e.id,
        pubkey: e.pubkey,
        content: e.content,
        createdAt: e.created_at,
      }));
  }

  /**
   * Parse show event (kind 31900)
   */
  private parseShowEvent(event: NDKEvent): Show {
    const getTag = (name: string) => event.tags.find((t) => t[0] === name)?.[1];
    const getTagAll = (name: string) => event.tags.filter((t) => t[0] === name).map((t) => t[1]);

    try {
      const content = JSON.parse(event.content);

      return {
        id: getTag('d') || event.id || '',
        pubkey: event.pubkey,
        name: content.name || getTag('title') || 'Untitled Show',
        description: content.description || content.summary || getTag('summary') || '',
        image: content.image || getTag('image'),
        feedUrl: getTag('feed'),
        authors: getTagAll('author'),
        createdAt: event.created_at || Math.floor(Date.now() / 1000),
        updatedAt: event.created_at || Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      this.logger.warn(`Failed to parse show event ${event.id}: ${error instanceof Error ? error.message : error}`);
      return {
        id: getTag('d') || event.id || '',
        pubkey: event.pubkey,
        name: getTag('title') || 'Untitled Show',
        description: getTag('summary') || event.content.slice(0, 200),
        authors: [event.pubkey],
        createdAt: event.created_at || Math.floor(Date.now() / 1000),
        updatedAt: event.created_at || Math.floor(Date.now() / 1000),
      };
    }
  }

  /**
   * Parse episode event (kind 31901)
   */
  private parseEpisodeEvent(event: NDKEvent): Episode {
    const getTag = (name: string) => event.tags.find((t) => t[0] === name)?.[1];

    try {
      const content = JSON.parse(event.content);

      return {
        id: getTag('d') || event.id || '',
        showId: getTag('a') || '',
        pubkey: event.pubkey,
        title: content.title || getTag('title') || getTag('name') || 'Untitled Episode',
        summary: content.summary || getTag('summary') || '',
        content: event.content,
        image: content.image || getTag('image') || getTag('thumb'),
        duration: getTag('duration') ? parseInt(getTag('duration')!) : undefined,
        fileUrl: getTag('url') || getTag('aurl'),
        contentType: getTag('media_type') || 'audio/mpeg',
        createdAt: event.created_at || Math.floor(Date.now() / 1000),
        updatedAt: event.created_at || Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      this.logger.warn(`Failed to parse episode event ${event.id}: ${error instanceof Error ? error.message : error}`);
      return {
        id: getTag('d') || event.id || '',
        showId: getTag('a') || '',
        pubkey: event.pubkey,
        title: getTag('title') || 'Untitled Episode',
        summary: getTag('summary') || '',
        content: event.content,
        image: getTag('image'),
        duration: getTag('duration') ? parseInt(getTag('duration')!) : undefined,
        fileUrl: getTag('url'),
        createdAt: event.created_at || Math.floor(Date.now() / 1000),
        updatedAt: event.created_at || Math.floor(Date.now() / 1000),
      };
    }
  }
}
