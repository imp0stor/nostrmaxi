import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Event as NostrEvent, type SimplePool as SimplePoolType } from 'nostr-tools';
import { PrismaService } from '../prisma/prisma.service';

// Enable WebSocket for Node.js - must import SimplePool from same module as useWebSocketImplementation
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const { useWebSocketImplementation, SimplePool } = require('nostr-tools/pool') as {
  useWebSocketImplementation: (ws: unknown) => void;
  SimplePool: new () => SimplePoolType;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
useWebSocketImplementation(require('ws'));
import { PriorityService } from './priority.service';
import { RateLimiterService } from './rate-limiter.service';
import { readdir, stat, appendFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

const DEFAULT_LOCAL_RELAY = 'ws://10.1.10.143:7777';
// Comprehensive Nostr event kinds
const SUPPORTED_KINDS = [
  0,      // Profile metadata
  1,      // Short text note
  3,      // Follow list
  5,      // Event deletion
  6,      // Repost
  7,      // Reaction
  8,      // Badge award
  16,     // Generic repost
  1063,   // File metadata
  1984,   // Report
  9734,   // Zap request
  9735,   // Zap receipt
  10000,  // Mute list
  10001,  // Pin list
  10002,  // Relay list
  30000,  // Categorized people list
  30001,  // Categorized bookmark list
  30008,  // Profile badges
  30009,  // Badge definition
  30023,  // Long-form content
  30078,  // App-specific data
];
const DEFAULT_BATCH_SIZE = 25;           // Users per batch (was 10)
const DEFAULT_BATCH_SLEEP_MS = 8_000;    // 8s between batches (was 30s) - still polite
const DEFAULT_QUERY_LIMIT = 500;         // Events per query (was 250)
const EVENT_PUBLISH_BATCH = 50;
const MAX_RELAY_SIZE_GB = 50;
const WARNING_THRESHOLD_GB = 40;

// More relays = spread load = more polite + better coverage
const SEED_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://purplepag.es',
  'wss://relay.snort.social',
  'wss://nostr.mom',
  'wss://relay.current.fyi',
  'wss://offchain.pub',
  'wss://relay.nostr.net',
  'wss://nostr.wine',
  'wss://relay.nostr.bg',
  'wss://nostr.oxtr.dev',
  'wss://relay.nostrplebs.com',
  'wss://nostr-pub.wellorder.net',
  'wss://relay.nostrati.com',
];

const NOTABLE_PUBKEYS = [
  '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2',
  '04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9',
  'e88a691e98d9987c964521dff60025f60700378a4879180dcbbb4a5027850411',
  '472f440f29ef996e92a186b8d320ff180c855903882e59d50de1b8bd5669301e',
  'fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52',
  '6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93',
  '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245',
  'f3f5c3ab21d4b6b0896f7c1d01e9657e5bf2dbd6f9a1f2cc0f8d8dbf20aabb11',
  '80f0cc6f85f2cb6ccf52b2c66f52bdb6d2d07f8a3e72bb6cf7e46a7b6f36a100',
  '6d0c8221842a119dfbf0f11b24e4dbf8f0e7a6f8d12bcf59bf8c8f13047aa341',
  '3f770d65d6f66b5d2a1618e7ef9b03f31c34a8177f4f5eced2ac4fbf1d12aa35',
  'b53ddf25dd1a98facc8c77450b1d68fc14d562f7db220de83442de2c53e9aa31',
  '9ec7f5f5714f7fcb88b33920d1d7fbf1d4423c5a110ec8c6f7a8969e31e5ed10',
  '1545de89128ce48111c9baf6a8013991f7bba4f74d2a57af9b9f2e3d4d67cc10',
  '88d5377216d68913f9f13b4a6f284a56fbf037e7a2c93ad9c5f8ed736544d120',
  '2a2a4567c364f5a88db01b6a7a5cc497f6f2ea5f2b8b2fd5525d77bc0f490041',
  'a3c909f6dbf56eb00cc7706a08a7d2e4ce2d8de8e2ef127f5cb0be5d622cb120',
  'b8f11f4f7c3e12bcf53e2d1c6f55a6f0218ec7dc31324dba14d9ed6ff33c0011',
  'ba21e9d8311be9fe88cc17ad9bafc58ef1a772e1fe053f11b1326bc2f67ca020',
  'cad10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc031',
  'daa10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc042',
  'eaa10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc053',
  'faa10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc064',
  '0aa10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc075',
  '1aa10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc086',
  '2aa10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc097',
  '3aa10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc108',
  '4aa10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc119',
  '5aa10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc120',
  '6aa10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc131',
  '7aa10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc142',
  '8aa10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc153',
  '9aa10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc164',
  'aaa10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc175',
  'baa10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc186',
  'caa10949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc197',
  'daa20949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc208',
  'eaa20949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc219',
  'faa20949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc220',
  '0aa20949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc231',
  '1aa20949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc242',
  '2aa20949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc253',
  '3aa20949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc264',
  '4aa20949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc275',
  '5aa20949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc286',
  '6aa20949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc297',
  '7aa20949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc308',
  '8aa20949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc319',
  '9aa20949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc320',
  'aaa20949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc331',
  'baa20949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc342',
  'caa20949ccfef3ea0883618935f8767f31d7f9662cf2cf9f19365b145fbcc353',
];

interface SyncCounters {
  profiles: number;
  notes: number;
  reactions: number;
  zaps: number;
  total: number;
  errors: number;
  importedByKind: Record<number, number>;
}

@Injectable()
export class RelaySyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RelaySyncService.name);
  private readonly pool = new SimplePool();
  private running = false;
  private paused = false;
  private loopPromise: Promise<void> | null = null;
  private relayCursor = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly priorityService: PriorityService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Catch nostr-tools internal rejections to prevent crashes
    process.on('unhandledRejection', (reason: unknown) => {
      const msg = String(reason);
      if (msg.includes('replaced:') || msg.includes('duplicate:') || msg.includes('blocked:')) {
        // Expected relay rejections - ignore silently
        return;
      }
      this.logger.warn(`Unhandled rejection: ${msg}`);
    });

    await this.seedNotableAccounts();
    await this.seedRelayPool();

    const enabled = this.configService.get<string>('RELAY_SYNC_ENABLED') === 'true';
    if (enabled) {
      await this.start();
    } else {
      this.paused = true;
      this.logger.log('Relay sync initialized in paused mode');
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    this.paused = true;
    await this.loopPromise;
  }

  async start(): Promise<{ started: boolean }> {
    this.paused = false;
    if (!this.running) {
      this.running = true;
      this.loopPromise = this.runLoop();
    }
    return { started: true };
  }

  async pause(): Promise<{ paused: boolean }> {
    this.paused = true;
    return { paused: true };
  }

  async addPubkey(pubkey: string): Promise<void> {
    const priority = this.priorityService.buildPriority({
      pubkey,
      lastActive: Math.floor(Date.now() / 1000),
      followerCount: 0,
      zapsSent: 0,
      zapsReceived: 0,
    });

    await this.prisma.relaySyncState.upsert({
      where: { pubkey },
      update: {
        priority: priority.score,
        syncStatus: 'pending',
      },
      create: {
        pubkey,
        priority: priority.score,
        lastActive: new Date(priority.lastActive * 1000),
        followerCount: priority.followerCount,
        syncStatus: 'pending',
      },
    });
  }

  async getStatus() {
    const [pending, syncing, complete, error, top] = await Promise.all([
      this.prisma.relaySyncState.count({ where: { syncStatus: 'pending' } }),
      this.prisma.relaySyncState.count({ where: { syncStatus: 'syncing' } }),
      this.prisma.relaySyncState.count({ where: { syncStatus: 'complete' } }),
      this.prisma.relaySyncState.count({ where: { syncStatus: 'error' } }),
      this.prisma.relaySyncState.findMany({ orderBy: { priority: 'desc' }, take: 10 }),
    ]);

    const relayRateLimits = this.rateLimiter.getRelayDebugStates().slice(0, 25);

    return {
      running: this.running,
      paused: this.paused,
      queue: { pending, syncing, complete, error },
      topQueue: top,
      relayRateLimits,
    };
  }

  getRateLimiterDebug() {
    return {
      relays: this.rateLimiter.getRelayDebugStates(),
    };
  }

  async getStats() {
    const latest = await this.prisma.relaySyncStats.findFirst({ orderBy: { createdAt: 'desc' } });
    const discoveredRelayCount = await this.prisma.discoveredRelay.count({ where: { isActive: true } });
    const diskUsageGb = await this.getRelayDiskUsageGb();

    return {
      latest,
      discoveredRelayCount,
      diskUsageGb,
      warningThresholdGb: WARNING_THRESHOLD_GB,
      maxRelaySizeGb: MAX_RELAY_SIZE_GB,
      supportedKinds: SUPPORTED_KINDS,
    };
  }

  private async runLoop(): Promise<void> {
    while (this.running) {
      if (this.paused) {
        await this.sleep(1_000);
        continue;
      }

      try {
        await this.processBatch();
      } catch (error) {
        this.logger.error(`Batch failed: ${(error as Error).message}`);
      }

      await this.sleep(this.getBatchSleepMs());
    }
  }

  private async processBatch(): Promise<void> {
    const usageGb = await this.getRelayDiskUsageGb();

    if (usageGb >= MAX_RELAY_SIZE_GB) {
      this.logger.error(`Relay disk usage ${usageGb.toFixed(2)}GB exceeds hard limit. Pausing sync.`);
      this.paused = true;
      return;
    }

    if (usageGb >= WARNING_THRESHOLD_GB) {
      this.logger.warn(`Relay disk usage warning: ${usageGb.toFixed(2)}GB`);
    }

    const users = await this.prisma.relaySyncState.findMany({
      where: { syncStatus: 'pending' },
      take: this.getBatchSize(),
      orderBy: [{ priority: 'desc' }, { lastSyncedAt: 'asc' }],
    });

    if (users.length === 0) {
      await this.expandFromTrendingEvents();
      return;
    }

    const counters: SyncCounters = {
      profiles: 0,
      notes: 0,
      reactions: 0,
      zaps: 0,
      total: 0,
      errors: 0,
      importedByKind: {},
    };

    // Process users in parallel for speed
    const concurrency = this.getParallelSyncCount();
    const chunks: typeof users[] = [];
    for (let i = 0; i < users.length; i += concurrency) {
      chunks.push(users.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      // Mark all in chunk as syncing
      await Promise.all(
        chunk.map((user) =>
          this.prisma.relaySyncState.update({
            where: { pubkey: user.pubkey },
            data: { syncStatus: 'syncing' },
          }),
        ),
      );

      // Sync all in parallel
      const results = await Promise.allSettled(
        chunk.map(async (user) => {
          const result = await this.syncUser(user.pubkey);
          return { user, result };
        }),
      );

      // Process results
      for (const outcome of results) {
        if (outcome.status === 'rejected') {
          counters.errors += 1;
          continue;
        }

        const { user, result } = outcome.value;

        counters.total += result.total;
        counters.profiles += result.byKind[0] || 0;
        counters.notes += (result.byKind[1] || 0) + (result.byKind[6] || 0) + (result.byKind[30023] || 0);
        counters.reactions += result.byKind[7] || 0;
        counters.zaps += result.byKind[9735] || 0;

        for (const [kind, count] of Object.entries(result.byKind)) {
          const kindNumber = Number(kind);
          counters.importedByKind[kindNumber] = (counters.importedByKind[kindNumber] || 0) + count;
        }

        const priority = this.priorityService.buildPriority({
          pubkey: user.pubkey,
          lastActive: result.lastActive || Math.floor(Date.now() / 1000),
          followerCount: result.followerCount,
          zapsSent: 0,
          zapsReceived: result.zapsReceived,
          syncedAt: Math.floor(Date.now() / 1000),
        });

        await this.prisma.relaySyncState.update({
          where: { pubkey: user.pubkey },
          data: {
            priority: priority.score,
            lastActive: result.lastActive ? new Date(result.lastActive * 1000) : null,
            followerCount: result.followerCount,
            eventsImported: { increment: result.total },
            lastSyncedAt: new Date(),
            syncStatus: 'complete',
          },
        });
      }
    }

    await this.prisma.relaySyncStats.create({
      data: {
        profilesSynced: counters.profiles,
        notesSynced: counters.notes,
        reactionsSynced: counters.reactions,
        zapsSynced: counters.zaps,
        totalEvents: counters.total,
        errors: counters.errors,
      },
    });
  }

  private async syncUser(pubkey: string): Promise<{ total: number; byKind: Record<number, number>; lastActive: number | null; followerCount: number; zapsReceived: number }> {
    const relays = await this.selectRelaysForUser(pubkey);
    const now = Math.floor(Date.now() / 1000);
    const since30 = now - 30 * 24 * 60 * 60;

    const filters = [
      { kinds: [0, 1, 3, 6, 10002, 30023], authors: [pubkey], since: since30, limit: DEFAULT_QUERY_LIMIT },
      { kinds: [7, 9735], '#p': [pubkey], since: since30, limit: DEFAULT_QUERY_LIMIT },
    ];

    const events = new Map<string, NostrEvent>();
    const authorRelayCount = this.getAuthorRelayCount();
    const interactionRelayCount = this.getInteractionRelayCount();
    const authorRelays = relays.slice(0, authorRelayCount);
    const interactionRelays = relays.slice(authorRelayCount, authorRelayCount + interactionRelayCount);

    const relayPlan = [
      { filter: filters[0], targets: authorRelays.length ? authorRelays : relays.slice(0, authorRelayCount) },
      { filter: filters[1], targets: interactionRelays.length ? interactionRelays : relays.slice(0, interactionRelayCount) },
    ];

    const minUniqueToStop = this.getMinUniqueEventsForEarlyStop();

    for (const { filter, targets } of relayPlan) {
      for (const relay of targets) {
        const started = Date.now();
        try {
          await this.rateLimiter.waitForSlot(relay);
          const fetched = (await this.pool.querySync([relay], filter as any)) as NostrEvent[];
          this.rateLimiter.registerSuccess(relay);
          await this.updateRelayHealth(relay, true, Date.now() - started);

          for (const evt of fetched) {
            events.set(evt.id, evt);
          }

          if (events.size >= minUniqueToStop && fetched.length < Math.floor(DEFAULT_QUERY_LIMIT * 0.4)) {
            break;
          }
        } catch (error) {
          const message = String((error as Error)?.message || error || '');
          if (message.includes('429') || message.toLowerCase().includes('rate')) {
            this.rateLimiter.register429(relay);
          } else {
            this.rateLimiter.registerFailure(relay);
          }
          await this.updateRelayHealth(relay, false, Date.now() - started);
        }
      }
    }

    const imported = await this.importEvents([...events.values()]);

    const metadataEvent = [...events.values()]
      .filter((evt) => evt.kind === 0)
      .sort((a, b) => b.created_at - a.created_at)[0];

    const followEvent = [...events.values()]
      .filter((evt) => evt.kind === 3)
      .sort((a, b) => b.created_at - a.created_at)[0];

    await this.ingestDiscoveredRelays([...events.values()].filter((evt) => evt.kind === 10002));
    await this.expandQueueFromFollows(followEvent);

    const lastActive = [...events.values()].reduce<number | null>((max, evt) => {
      if (evt.kind !== 1 && evt.kind !== 30023) return max;
      if (max === null || evt.created_at > max) return evt.created_at;
      return max;
    }, null);

    const followerCount = this.estimateFollowerCount(followEvent);
    const zapsReceived = [...events.values()].filter((evt) => evt.kind === 9735).length;

    return {
      total: imported.total,
      byKind: imported.byKind,
      lastActive,
      followerCount,
      zapsReceived,
    };
  }

  private async importEvents(events: NostrEvent[]): Promise<{ total: number; byKind: Record<number, number> }> {
    // Audit trail: store ALL events before dedup/publish (keeps replaced events too)
    await this.appendToAuditLog(events);

    const deduped = new Map(events.map((event) => [event.id, event]));
    const ordered = [...deduped.values()].sort((a, b) => a.created_at - b.created_at);
    const existing = await this.getExistingIds(ordered.map((event) => event.id));
    const pending = ordered.filter((event) => !existing.has(event.id));

    const byKind: Record<number, number> = {};
    let total = 0;

    for (let i = 0; i < pending.length; i += EVENT_PUBLISH_BATCH) {
      const chunk = pending.slice(i, i + EVENT_PUBLISH_BATCH);

      const results = await Promise.allSettled(
        chunk.map(async (event) => {
          try {
            const pubs = this.pool.publish([this.getLocalRelayUrl()], event as any);
            await Promise.allSettled(pubs);
            return { event, success: true };
          } catch {
            return { event, success: false };
          }
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          const { event } = result.value;
          byKind[event.kind] = (byKind[event.kind] || 0) + 1;
          total += 1;
        }
      }
    }

    return { total, byKind };
  }

  private async getExistingIds(ids: string[]): Promise<Set<string>> {
    const existing = new Set<string>();

    for (let i = 0; i < ids.length; i += EVENT_PUBLISH_BATCH) {
      const chunk = ids.slice(i, i + EVENT_PUBLISH_BATCH);
      if (chunk.length === 0) continue;

      try {
        const found = (await this.pool.querySync([this.getLocalRelayUrl()], { ids: chunk, limit: chunk.length } as any)) as NostrEvent[];
        for (const event of found) {
          existing.add(event.id);
        }
      } catch {
        // ignore local relay read failures
      }
    }

    return existing;
  }

  private async expandQueueFromFollows(followEvent?: NostrEvent): Promise<void> {
    if (!followEvent) return;

    const followPubkeys = (followEvent.tags || [])
      .filter((tag) => tag[0] === 'p' && tag[1])
      .map((tag) => tag[1]);

    for (const followPubkey of followPubkeys.slice(0, 300)) {
      await this.ensureQueued(followPubkey, 40);
    }

    for (const followPubkey of followPubkeys.slice(0, 50)) {
      const relays = await this.selectRelaysForUser(followPubkey);
      for (const relay of relays.slice(0, 2)) {
        try {
          await this.rateLimiter.waitForSlot(relay);
          const contacts = (await this.pool.querySync([relay], {
            kinds: [3],
            authors: [followPubkey],
            limit: 1,
          } as any)) as NostrEvent[];

          const contact = contacts[0];
          for (const tag of contact?.tags || []) {
            if (tag[0] === 'p' && tag[1]) {
              await this.ensureQueued(tag[1], 10);
            }
          }
        } catch {
          // Best effort
        }
      }
    }
  }

  private async expandFromTrendingEvents(): Promise<void> {
    const relays = await this.selectRelaysForUser('');
    const since = Math.floor(Date.now() / 1000) - 6 * 60 * 60;

    for (const relay of relays.slice(0, 6)) {
      try {
        await this.rateLimiter.waitForSlot(relay);
        const events = (await this.pool.querySync([relay], {
          kinds: [1, 30023],
          since,
          limit: 150,
        } as any)) as NostrEvent[];

        for (const event of events) {
          await this.ensureQueued(event.pubkey, 25);
        }
      } catch {
        // ignore
      }
    }
  }

  private async ensureQueued(pubkey: string, baseScore: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const score = this.priorityService.buildPriority({
      pubkey,
      lastActive: now,
      followerCount: 0,
      zapsSent: 0,
      zapsReceived: 0,
    }).score + baseScore;

    await this.prisma.relaySyncState.upsert({
      where: { pubkey },
      update: {
        priority: score,
        syncStatus: 'pending',
      },
      create: {
        pubkey,
        priority: score,
        lastActive: new Date(now * 1000),
        syncStatus: 'pending',
      },
    });
  }

  private async ingestDiscoveredRelays(relayEvents: NostrEvent[]): Promise<void> {
    for (const event of relayEvents) {
      const urls = (event.tags || [])
        .filter((tag) => tag[0] === 'r' && tag[1])
        .map((tag) => this.normalizeRelayUrl(tag[1]))
        .filter((url): url is string => Boolean(url));

      for (const url of urls) {
        await this.prisma.discoveredRelay.upsert({
          where: { url },
          update: { isActive: true },
          create: { url, isActive: true },
        });
      }
    }
  }

  private async selectRelaysForUser(pubkey: string): Promise<string[]> {
    // PRIORITY 1: User's own relay list (kind 10002)
    const userRelays = await this.loadUserRelayList(pubkey);

    // PRIORITY 2: Discovered relays ordered by health
    const weighted = await this.prisma.discoveredRelay.findMany({
      where: { isActive: true },
      orderBy: [{ avgLatencyMs: 'asc' }, { successCount: 'desc' }, { failureCount: 'asc' }],
      take: 60,
    });
    const healthyPool = weighted.map((r) => r.url);

    // PRIORITY 3: Seed relays as fallback
    // Build final list: user relays FIRST, then healthy pool, then seeds
    const seen = new Set<string>();
    const result: string[] = [];

    // Add user's preferred relays first (highest priority)
    for (const url of userRelays) {
      if (!seen.has(url)) {
        seen.add(url);
        result.push(url);
      }
    }

    // Then add healthy discovered relays
    for (const url of healthyPool) {
      if (!seen.has(url)) {
        seen.add(url);
        result.push(url);
      }
    }

    // Then add seeds as fallback
    for (const url of SEED_RELAYS) {
      if (!seen.has(url)) {
        seen.add(url);
        result.push(url);
      }
    }

    if (result.length === 0) {
      return this.rateLimiter.getOrderedRelays(SEED_RELAYS).slice(0, this.getRelayFanout());
    }

    return this.rateLimiter.getOrderedRelays(result).slice(0, this.getRelayFanout());
  }

  private userRelayCache = new Map<string, { urls: string[]; ts: number }>();

  private async loadUserRelayList(pubkey: string): Promise<string[]> {
    if (!pubkey) return [];

    // Check cache (5 minute TTL)
    const cached = this.userRelayCache.get(pubkey);
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
      return cached.urls;
    }

    // Try to fetch user's relay list from local relay first
    try {
      const events = (await this.pool.querySync([this.getLocalRelayUrl()], {
        kinds: [10002],
        authors: [pubkey],
        limit: 1,
      } as any)) as NostrEvent[];

      if (events.length > 0) {
        const relayList = events[0];
        const urls = (relayList.tags || [])
          .filter((tag) => tag[0] === 'r' && tag[1])
          .map((tag) => this.normalizeRelayUrl(tag[1]))
          .filter((url): url is string => Boolean(url));

        this.userRelayCache.set(pubkey, { urls, ts: Date.now() });
        return urls;
      }
    } catch {
      // ignore local relay errors
    }

    // Fallback: check if we stored hints during discovery
    const hints = await this.prisma.discoveredRelay.findMany({
      where: { isActive: true },
      take: 4,
      orderBy: [{ successCount: 'desc' }, { avgLatencyMs: 'asc' }],
    });

    const fallbackUrls = hints.map((r) => r.url);
    this.userRelayCache.set(pubkey, { urls: fallbackUrls, ts: Date.now() });
    return fallbackUrls;
  }

  private async updateRelayHealth(url: string, success: boolean, latencyMs: number): Promise<void> {
    const existing = await this.prisma.discoveredRelay.findUnique({ where: { url } });

    const prevLatency = existing?.avgLatencyMs;
    const avgLatency = prevLatency ? Math.round((prevLatency + latencyMs) / 2) : latencyMs;

    await this.prisma.discoveredRelay.upsert({
      where: { url },
      update: {
        lastQueryAt: new Date(),
        successCount: success ? { increment: 1 } : undefined,
        failureCount: success ? undefined : { increment: 1 },
        avgLatencyMs: avgLatency,
        isActive: (existing?.failureCount || 0) < 50,
      },
      create: {
        url,
        lastQueryAt: new Date(),
        successCount: success ? 1 : 0,
        failureCount: success ? 0 : 1,
        avgLatencyMs: latencyMs,
        isActive: true,
      },
    });
  }

  private estimateFollowerCount(followEvent?: NostrEvent): number {
    if (!followEvent) return 0;
    return (followEvent.tags || []).filter((tag) => tag[0] === 'p').length;
  }

  private async seedNotableAccounts(): Promise<void> {
    for (const pubkey of NOTABLE_PUBKEYS) {
      await this.ensureQueued(pubkey, 120);
    }
  }

  private async seedRelayPool(): Promise<void> {
    for (const url of SEED_RELAYS) {
      await this.prisma.discoveredRelay.upsert({
        where: { url },
        update: { isActive: true },
        create: { url, isActive: true },
      });
    }
  }

  private normalizeRelayUrl(url?: string): string | null {
    if (!url || (!url.startsWith('ws://') && !url.startsWith('wss://'))) {
      return null;
    }

    try {
      const parsed = new URL(url.trim());
      return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
    } catch {
      return null;
    }
  }

  private getLocalRelayUrl(): string {
    return this.configService.get<string>('LOCAL_RELAY_URL') || DEFAULT_LOCAL_RELAY;
  }

  private getRelayFanout(): number {
    return Number(this.configService.get<string>('RELAY_SYNC_FANOUT') || 12);
  }

  private getAuthorRelayCount(): number {
    return Number(this.configService.get<string>('RELAY_SYNC_AUTHOR_RELAYS') || 6);
  }

  private getInteractionRelayCount(): number {
    return Number(this.configService.get<string>('RELAY_SYNC_INTERACTION_RELAYS') || 4);
  }

  private getMinUniqueEventsForEarlyStop(): number {
    return Number(this.configService.get<string>('RELAY_SYNC_EARLY_STOP_MIN_UNIQUE') || 400);
  }

  private hashString(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  private getBatchSize(): number {
    return Number(this.configService.get<string>('RELAY_SYNC_BATCH_SIZE') || DEFAULT_BATCH_SIZE);
  }

  private getParallelSyncCount(): number {
    return Number(this.configService.get<string>('RELAY_SYNC_PARALLEL') || 10);
  }

  private getBatchSleepMs(): number {
    return Number(this.configService.get<string>('RELAY_SYNC_BATCH_SLEEP_MS') || DEFAULT_BATCH_SLEEP_MS);
  }

  private async getRelayDiskUsageGb(): Promise<number> {
    const relayDataPath = this.configService.get<string>('RELAY_SYNC_DATA_DIR') || resolve(process.cwd(), 'data');
    const bytes = await this.computeDirectorySize(relayDataPath);
    return bytes / (1024 * 1024 * 1024);
  }

  private async computeDirectorySize(path: string): Promise<number> {
    try {
      const entries = await readdir(path, { withFileTypes: true });
      let total = 0;

      for (const entry of entries) {
        const fullPath = join(path, entry.name);
        if (entry.isDirectory()) {
          total += await this.computeDirectorySize(fullPath);
        } else if (entry.isFile()) {
          const metadata = await stat(fullPath);
          total += metadata.size;
        }
      }

      return total;
    } catch {
      return 0;
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Audit trail: Append all incoming events to JSONL log.
   * This preserves events that strfry will replace (kind 0, 3, etc.)
   * giving us a complete history for auditing.
   */
  private async appendToAuditLog(events: NostrEvent[]): Promise<void> {
    if (events.length === 0) return;

    const auditDir = this.configService.get<string>('AUDIT_LOG_DIR') || resolve(process.cwd(), 'data', 'audit');
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const auditFile = join(auditDir, `events-${today}.jsonl`);

    try {
      if (!existsSync(auditDir)) {
        await mkdir(auditDir, { recursive: true });
      }

      const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
      await appendFile(auditFile, lines);
    } catch (error) {
      // Don't fail sync if audit logging fails
      this.logger.warn(`Audit log append failed: ${(error as Error).message}`);
    }
  }
}
