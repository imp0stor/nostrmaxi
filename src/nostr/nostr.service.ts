import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import NDK, { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';

/**
 * Nostr service provides NDK-based access to relays
 * Centralizes Nostr event querying, subscriptions, and publishing
 */
@Injectable()
export class NostrService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NostrService.name);
  private ndk: NDK | null = null;
  private relayUrls: string[];

  constructor(private configService: ConfigService) {
    // Get relay URLs from config, default to nostrcheck relay + public relays
    const defaultRelays = [
      'ws://10.1.10.143:7777', // Private dev relay
      'wss://relay.damus.io',
      'wss://relay.nostr.band',
      'wss://nos.lol',
    ];

    const configRelays = this.configService.get<string>('NOSTR_RELAYS');
    this.relayUrls = configRelays ? configRelays.split(',') : defaultRelays;
  }

  /**
   * Initialize NDK on module startup
   */
  async onModuleInit() {
    try {
      this.ndk = new NDK({
        explicitRelayUrls: this.relayUrls,
        autoConnectUserRelays: false,
      });

      await this.ndk.connect();
      this.logger.log(`NDK connected to ${this.relayUrls.length} relays`);
    } catch (error) {
      this.logger.error(`Failed to initialize NDK: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  /**
   * Cleanup on module shutdown
   */
  async onModuleDestroy() {
    // NDK doesn't have disconnect, connections are managed internally
    this.logger.log('NostrService shutdown');
  }

  /**
   * Get the NDK instance (internal use)
   */
  getNdk(): NDK {
    if (!this.ndk) {
      throw new Error('NDK not initialized');
    }
    return this.ndk;
  }

  /**
   * Query events from relays
   */
  async queryEvents(filter: NDKFilter, timeoutMs = 5000): Promise<NDKEvent[]> {
    if (!this.ndk) {
      throw new Error('NDK not initialized');
    }

    const events = await this.ndk.fetchEvents(filter);
    return Array.from(events);
  }

  /**
   * Subscribe to events with real-time updates
   */
  subscribe(filter: NDKFilter) {
    if (!this.ndk) {
      throw new Error('NDK not initialized');
    }

    return this.ndk.subscribe(filter);
  }

  /**
   * Get user profile
   */
  async getUserProfile(pubkey: string, timeoutMs = 5000) {
    const events = await this.queryEvents(
      {
        kinds: [0], // Profile metadata
        authors: [pubkey],
      },
      timeoutMs,
    );

    if (events.length === 0) {
      return null;
    }

    try {
      return JSON.parse(events[0].content);
    } catch {
      return null;
    }
  }

  /**
   * Get user's contact list (follows)
   */
  async getUserFollows(pubkey: string, timeoutMs = 5000): Promise<string[]> {
    const events = await this.queryEvents(
      {
        kinds: [3], // Contact list
        authors: [pubkey],
        limit: 1,
      },
      timeoutMs,
    );

    if (events.length === 0) {
      return [];
    }

    // Extract p-tagged pubkeys (follows)
    return events[0].tags
      .filter((tag) => tag[0] === 'p')
      .map((tag) => tag[1])
      .filter((pubkey) => pubkey && pubkey.length === 64);
  }

  /**
   * Get followers (pubkeys that follow this pubkey)
   */
  async getUserFollowers(pubkey: string, limit = 100, timeoutMs = 5000): Promise<string[]> {
    const events = await this.queryEvents(
      {
        kinds: [3], // Contact list
        '#p': [pubkey], // Follows this pubkey
        limit,
      },
      timeoutMs,
    );

    // Return unique follower pubkeys
    return [...new Set(events.map((e) => e.pubkey))];
  }

  /**
   * Query episodes (kind 31901)
   */
  async getEpisodes(filters?: {
    authors?: string[];
    since?: number;
    until?: number;
    limit?: number;
  }): Promise<NDKEvent[]> {
    return this.queryEvents(
      {
        kinds: [31901 as any],
        ...filters,
      },
      5000,
    );
  }

  /**
   * Query shows (kind 31900)
   */
  async getShows(filters?: {
    authors?: string[];
    since?: number;
    until?: number;
    limit?: number;
  }): Promise<NDKEvent[]> {
    return this.queryEvents(
      {
        kinds: [31900 as any],
        ...filters,
      },
      5000,
    );
  }

  /**
   * Query notes (kind 1)
   */
  async getNotes(filters?: {
    authors?: string[];
    since?: number;
    until?: number;
    limit?: number;
  }): Promise<NDKEvent[]> {
    return this.queryEvents(
      {
        kinds: [1],
        ...filters,
      },
      5000,
    );
  }

  /**
   * Query products (kind 30018 - NIP-15)
   */
  async getProducts(filters?: {
    authors?: string[];
    since?: number;
    until?: number;
    limit?: number;
  }): Promise<NDKEvent[]> {
    return this.queryEvents(
      {
        kinds: [30018 as any],
        ...filters,
      },
      5000,
    );
  }

  /**
   * Query bounties (kind 31903)
   */
  async getBounties(filters?: {
    authors?: string[];
    since?: number;
    until?: number;
    limit?: number;
  }): Promise<NDKEvent[]> {
    return this.queryEvents(
      {
        kinds: [31903 as any],
        ...filters,
      },
      5000,
    );
  }

  /**
   * Query Q&A questions (kind 31905)
   */
  async getQuestions(filters?: {
    authors?: string[];
    since?: number;
    until?: number;
    limit?: number;
  }): Promise<NDKEvent[]> {
    return this.queryEvents(
      {
        kinds: [31905 as any],
        ...filters,
      },
      5000,
    );
  }

  /**
   * Get recent activity (notes + reposts + reactions)
   */
  async getRecentActivity(pubkey: string, days = 30): Promise<NDKEvent[]> {
    const since = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
    return this.queryEvents(
      {
        kinds: [1, 6, 7], // Notes, reposts, reactions
        authors: [pubkey],
        since,
        limit: 100,
      },
      5000,
    );
  }
}
