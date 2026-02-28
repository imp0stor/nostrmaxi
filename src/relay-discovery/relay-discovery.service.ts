import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';

export interface DiscoveredRelay {
  url: string;
  firstSeen: number;
  lastSeen: number;
  seenInUsers: number;
  seenInWrites: number;
  seenInReads: number;
  avgResponseMs?: number;
  lastProbe?: number;
  isOnline?: boolean;
}

interface PersistedRelay extends DiscoveredRelay {
  seenUsers?: string[];
  writeUsers?: string[];
  readUsers?: string[];
}

interface RelayEntry {
  url: string;
  read: boolean;
  write: boolean;
}

@Injectable()
export class RelayDiscoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RelayDiscoveryService.name);
  private readonly relays = new Map<string, DiscoveredRelay>();
  private readonly seenUsers = new Map<string, Set<string>>();
  private readonly seenWriters = new Map<string, Set<string>>();
  private readonly seenReaders = new Map<string, Set<string>>();
  private readonly dataPath = resolve(process.cwd(), 'data/discovered-relays.json');
  private probeTimer: NodeJS.Timeout | null = null;

  async onModuleInit(): Promise<void> {
    await this.loadFromDisk();
    this.probeTimer = setInterval(() => {
      this.probeAllRelays().catch((error) => {
        this.logger.warn(`Relay probe batch failed: ${error.message}`);
      });
    }, 4 * 60 * 60 * 1000);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
  }

  async processRelayList(event: NostrEvent): Promise<string[]> {
    const now = Date.now();
    const user = event.pubkey;
    const discovered: string[] = [];

    const entries = this.extractRelayEntries(event);
    for (const entry of entries) {
      const existing = this.relays.get(entry.url);
      if (!existing) {
        discovered.push(entry.url);
      }

      const relay: DiscoveredRelay = existing || {
        url: entry.url,
        firstSeen: now,
        lastSeen: now,
        seenInUsers: 0,
        seenInWrites: 0,
        seenInReads: 0,
      };

      relay.lastSeen = now;
      this.relays.set(entry.url, relay);

      this.ensureSet(this.seenUsers, entry.url).add(user);
      if (entry.write) this.ensureSet(this.seenWriters, entry.url).add(user);
      if (entry.read) this.ensureSet(this.seenReaders, entry.url).add(user);

      relay.seenInUsers = this.seenUsers.get(entry.url)?.size || 0;
      relay.seenInWrites = this.seenWriters.get(entry.url)?.size || 0;
      relay.seenInReads = this.seenReaders.get(entry.url)?.size || 0;
    }

    if (entries.length > 0) {
      await this.persist();
    }

    return discovered;
  }

  async processContactList(event: NostrEvent): Promise<string[]> {
    const discovered: string[] = [];
    const now = Date.now();

    for (const tag of event.tags || []) {
      if (tag[0] !== 'p' || !tag[2]) continue;
      const normalized = this.normalizeRelayUrl(tag[2]);
      if (!normalized) continue;

      const existing = this.relays.get(normalized);
      if (!existing) {
        discovered.push(normalized);
      }

      const relay: DiscoveredRelay = existing || {
        url: normalized,
        firstSeen: now,
        lastSeen: now,
        seenInUsers: 0,
        seenInWrites: 0,
        seenInReads: 0,
      };

      relay.lastSeen = now;
      this.relays.set(normalized, relay);
      this.ensureSet(this.seenUsers, normalized).add(event.pubkey);
      relay.seenInUsers = this.seenUsers.get(normalized)?.size || relay.seenInUsers;
    }

    if (discovered.length > 0) {
      await this.persist();
    }

    return discovered;
  }

  async processMetadata(event: NostrEvent): Promise<string[]> {
    const discovered: string[] = [];
    const now = Date.now();
    const candidates = new Set<string>();

    for (const tag of event.tags || []) {
      if (tag[0] === 'r' && tag[1]) candidates.add(tag[1]);
    }

    try {
      const parsed = JSON.parse(event.content || '{}') as Record<string, unknown>;
      this.extractRelaysFromUnknown(parsed.relays, candidates);
      this.extractRelaysFromUnknown(parsed.relay, candidates);
      this.extractRelaysFromUnknown(parsed.relay_url, candidates);
      this.extractRelaysFromUnknown(parsed.relayUrl, candidates);
      this.extractRelaysFromUnknown(parsed.relays_hint, candidates);
    } catch {
      // Ignore invalid metadata JSON
    }

    for (const candidate of candidates) {
      const normalized = this.normalizeRelayUrl(candidate);
      if (!normalized) continue;

      const existing = this.relays.get(normalized);
      if (!existing) {
        discovered.push(normalized);
      }

      const relay: DiscoveredRelay = existing || {
        url: normalized,
        firstSeen: now,
        lastSeen: now,
        seenInUsers: 0,
        seenInWrites: 0,
        seenInReads: 0,
      };

      relay.lastSeen = now;
      this.relays.set(normalized, relay);
      this.ensureSet(this.seenUsers, normalized).add(event.pubkey);
      relay.seenInUsers = this.seenUsers.get(normalized)?.size || relay.seenInUsers;
    }

    if (discovered.length > 0) {
      await this.persist();
    }

    return discovered;
  }

  getDiscoveredRelays(): DiscoveredRelay[] {
    return [...this.relays.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  }

  getPopularRelays(limit: number): DiscoveredRelay[] {
    return [...this.relays.values()]
      .sort((a, b) => b.seenInUsers - a.seenInUsers || b.seenInWrites - a.seenInWrites)
      .slice(0, Math.max(0, limit));
  }

  async probeRelay(url: string): Promise<{ online: boolean; responseMs: number }> {
    const started = Date.now();
    const pool = new SimplePool();

    try {
      await Promise.race([
        pool.querySync([url], { kinds: [1], limit: 1 } as any),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ]);
      return { online: true, responseMs: Date.now() - started };
    } catch {
      return { online: false, responseMs: Date.now() - started };
    } finally {
      pool.close([url]);
    }
  }

  // Intended cadence: every 4 hours.
  async probeAllRelays(): Promise<void> {
    const all = this.getDiscoveredRelays();
    if (all.length === 0) return;

    for (const relay of all) {
      try {
        const result = await this.probeRelay(relay.url);
        relay.isOnline = result.online;
        relay.lastProbe = Date.now();
        relay.avgResponseMs = relay.avgResponseMs
          ? Math.round((relay.avgResponseMs + result.responseMs) / 2)
          : result.responseMs;
      } catch (error) {
        this.logger.warn(`Probe failed for ${relay.url}: ${(error as Error).message}`);
      }
    }

    await this.persist();
  }

  extractRelayEntries(event: NostrEvent): RelayEntry[] {
    const entries: RelayEntry[] = [];
    for (const tag of event.tags || []) {
      if (tag[0] !== 'r' || !tag[1]) continue;
      const normalized = this.normalizeRelayUrl(tag[1]);
      if (!normalized) continue;

      const marker = (tag[2] || '').toLowerCase();
      const read = marker === 'read' || marker === '';
      const write = marker === 'write' || marker === '';

      entries.push({ url: normalized, read, write });
    }
    return entries;
  }

  private normalizeRelayUrl(input?: string): string | null {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed.startsWith('ws://') && !trimmed.startsWith('wss://')) return null;

    try {
      const parsed = new URL(trimmed);
      const pathname = parsed.pathname.replace(/\/$/, '');
      const normalizedPath = pathname && pathname !== '/' ? pathname : '';
      const query = parsed.search || '';
      return `${parsed.protocol}//${parsed.host}${normalizedPath}${query}`;
    } catch {
      return null;
    }
  }

  private ensureSet(map: Map<string, Set<string>>, key: string): Set<string> {
    let set = map.get(key);
    if (!set) {
      set = new Set<string>();
      map.set(key, set);
    }
    return set;
  }

  private extractRelaysFromUnknown(value: unknown, out: Set<string>): void {
    if (!value) return;

    if (typeof value === 'string') {
      out.add(value);
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') out.add(item);
        if (item && typeof item === 'object') {
          const v = (item as Record<string, unknown>).url;
          if (typeof v === 'string') out.add(v);
        }
      }
      return;
    }

    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (typeof k === 'string' && (k.startsWith('ws://') || k.startsWith('wss://'))) {
          out.add(k);
        }
        if (typeof v === 'string' && (v.startsWith('ws://') || v.startsWith('wss://'))) {
          out.add(v);
        }
      }
    }
  }

  private async loadFromDisk(): Promise<void> {
    await mkdir(dirname(this.dataPath), { recursive: true });

    try {
      const raw = await readFile(this.dataPath, 'utf-8');
      const parsed = JSON.parse(raw) as PersistedRelay[];

      for (const relay of parsed || []) {
        this.relays.set(relay.url, {
          url: relay.url,
          firstSeen: relay.firstSeen,
          lastSeen: relay.lastSeen,
          seenInUsers: relay.seenInUsers || 0,
          seenInWrites: relay.seenInWrites || 0,
          seenInReads: relay.seenInReads || 0,
          avgResponseMs: relay.avgResponseMs,
          lastProbe: relay.lastProbe,
          isOnline: relay.isOnline,
        });

        this.seenUsers.set(relay.url, new Set(relay.seenUsers || []));
        this.seenWriters.set(relay.url, new Set(relay.writeUsers || []));
        this.seenReaders.set(relay.url, new Set(relay.readUsers || []));
      }
    } catch {
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.dataPath), { recursive: true });

    const payload: PersistedRelay[] = [...this.relays.values()].map((relay) => ({
      ...relay,
      seenUsers: [...(this.seenUsers.get(relay.url) || new Set<string>())],
      writeUsers: [...(this.seenWriters.get(relay.url) || new Set<string>())],
      readUsers: [...(this.seenReaders.get(relay.url) || new Set<string>())],
    }));

    await writeFile(this.dataPath, JSON.stringify(payload, null, 2), 'utf-8');
  }
}

export type { RelayEntry };
