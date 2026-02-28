import { Injectable, Logger } from '@nestjs/common';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { RelayDiscoveryService } from '../relay-discovery/relay-discovery.service';

const LOCAL_RELAY = 'ws://10.1.10.143:7777';
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

interface SyncResult {
  synced: number;
  alreadyHad: number;
  failed: number;
  oldestEvent: number | null;
  newestEvent: number | null;
}

interface SyncState {
  users: Record<string, number>;
}

@Injectable()
export class UserSyncService {
  private readonly logger = new Logger(UserSyncService.name);
  private pool: SimplePool;
  private readonly syncStatePath = resolve(process.cwd(), 'data/sync-state.json');

  constructor(private readonly relayDiscovery: RelayDiscoveryService) {
    this.pool = new SimplePool();
  }

  // This should trigger on ANY login, not just premium.
  // Premium status only gates analytics, not relay sync.
  async onUserLogin(pubkey: string): Promise<void> {
    await this.deltaSyncUserNotes(pubkey);
  }

  // Sync user's historical notes to local relay
  async syncUserNotes(pubkey: string, relays?: string[]): Promise<SyncResult> {
    const sourceRelays = relays?.length ? relays : DEFAULT_RELAYS;
    const filter = { kinds: [1], authors: [pubkey], limit: 5000 };

    let events: NostrEvent[] = [];
    try {
      events = (await this.pool.querySync(sourceRelays, filter as any)) as NostrEvent[];
    } catch (error) {
      this.logger.error(`Failed to fetch historical notes for ${pubkey}: ${error.message}`);
      return {
        synced: 0,
        alreadyHad: 0,
        failed: 1,
        oldestEvent: null,
        newestEvent: null,
      };
    }

    const result = await this.publishToLocalRelay(events);
    await this.syncUserRelayConfig(pubkey, sourceRelays);

    if (result.newestEvent !== null) {
      await this.setLastSyncTime(pubkey, result.newestEvent);
    }

    return result;
  }

  // Delta sync - only fetch events newer than last sync
  async deltaSyncUserNotes(pubkey: string, since?: number): Promise<SyncResult> {
    const lastSync = since ?? (await this.getLastSyncTime(pubkey));

    // First-time sync: fetch all historical notes.
    if (!lastSync) {
      return this.syncUserNotes(pubkey);
    }

    const filter = {
      kinds: [1],
      authors: [pubkey],
      since: lastSync + 1,
      limit: 2000,
    };

    let events: NostrEvent[] = [];
    try {
      events = (await this.pool.querySync(DEFAULT_RELAYS, filter as any)) as NostrEvent[];
    } catch (error) {
      this.logger.error(`Failed delta sync for ${pubkey}: ${error.message}`);
      return {
        synced: 0,
        alreadyHad: 0,
        failed: 1,
        oldestEvent: null,
        newestEvent: null,
      };
    }

    const result = await this.publishToLocalRelay(events);

    // Move the sync cursor forward even if no new events were found.
    await this.setLastSyncTime(pubkey, result.newestEvent ?? Math.floor(Date.now() / 1000));
    await this.syncUserRelayConfig(pubkey, DEFAULT_RELAYS);

    return result;
  }

  async syncUserRelayConfig(pubkey: string, relays?: string[]): Promise<void> {
    const sourceRelays = relays?.length ? relays : DEFAULT_RELAYS;
    const pool = new SimplePool();

    try {
      const events = (await pool.querySync(sourceRelays, {
        authors: [pubkey],
        kinds: [0, 3, 10002],
        limit: 200,
      } as any)) as NostrEvent[];

      for (const event of events.sort((a, b) => a.created_at - b.created_at)) {
        await this.publishToLocal(event);

        if (event.kind === 10002) {
          await this.relayDiscovery.processRelayList(event);
        } else if (event.kind === 3) {
          await this.relayDiscovery.processContactList(event);
        } else if (event.kind === 0) {
          await this.relayDiscovery.processMetadata(event);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed relay config sync for ${pubkey}: ${error.message}`);
    } finally {
      pool.close(sourceRelays);
    }
  }

  // Get last sync timestamp for user
  async getLastSyncTime(pubkey: string): Promise<number | null> {
    const state = await this.readSyncState();
    return state.users[pubkey] ?? null;
  }

  // Store last sync timestamp
  async setLastSyncTime(pubkey: string, timestamp: number): Promise<void> {
    const state = await this.readSyncState();
    state.users[pubkey] = timestamp;
    await this.writeSyncState(state);
  }

  private async publishToLocal(event: NostrEvent): Promise<void> {
    try {
      await Promise.allSettled(this.pool.publish([LOCAL_RELAY], event as any));
    } catch {
      // Best effort only
    }
  }

  private async publishToLocalRelay(events: NostrEvent[]): Promise<SyncResult> {
    if (events.length === 0) {
      return {
        synced: 0,
        alreadyHad: 0,
        failed: 0,
        oldestEvent: null,
        newestEvent: null,
      };
    }

    const deduped = new Map<string, NostrEvent>();
    for (const event of events) deduped.set(event.id, event);

    let synced = 0;
    let alreadyHad = 0;
    let failed = 0;

    const ordered = [...deduped.values()].sort((a, b) => a.created_at - b.created_at);

    for (const event of ordered) {
      try {
        const pubs = this.pool.publish([LOCAL_RELAY], event as any);
        const statuses = await Promise.allSettled(pubs);

        const hasOk = statuses.some((status) => status.status === 'fulfilled');
        if (hasOk) {
          synced++;
          continue;
        }

        const hasDuplicate = statuses.some(
          (status) =>
            status.status === 'rejected' &&
            String(status.reason ?? '').toLowerCase().includes('duplicate'),
        );

        if (hasDuplicate) {
          alreadyHad++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return {
      synced,
      alreadyHad,
      failed,
      oldestEvent: ordered[0]?.created_at ?? null,
      newestEvent: ordered[ordered.length - 1]?.created_at ?? null,
    };
  }

  private async readSyncState(): Promise<SyncState> {
    await mkdir(dirname(this.syncStatePath), { recursive: true });

    try {
      const raw = await readFile(this.syncStatePath, 'utf-8');
      const parsed = JSON.parse(raw) as SyncState;
      if (parsed && parsed.users && typeof parsed.users === 'object') {
        return parsed;
      }
    } catch {
      // Ignore missing/invalid file and recreate below.
    }

    const initial: SyncState = { users: {} };
    await this.writeSyncState(initial);
    return initial;
  }

  private async writeSyncState(state: SyncState): Promise<void> {
    await mkdir(dirname(this.syncStatePath), { recursive: true });
    await writeFile(this.syncStatePath, JSON.stringify(state, null, 2), 'utf-8');
  }
}

export type { SyncResult };
