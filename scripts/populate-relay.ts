import { SimplePool, type Event as NostrEvent } from 'nostr-tools';

const LOCAL_RELAY = 'ws://10.1.10.143:7777';
const SOURCE_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://purplepag.es',
  'wss://relay.snort.social',
];

// Notable accounts to seed (high-value content creators)
const NOTABLE_PUBKEYS = [
  '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2', // jack
  '04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9', // odell
  'e88a691e98d9987c964521dff60025f60700378a4879180dcbbb4a5027850411', // nvk
  '472f440f29ef996e92a186b8d320ff180c855903882e59d50de1b8bd5669301e', // marty bent
  'fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52', // pablof7z
  '6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93', // gigi
  '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245', // jb55
  'eab0e756d32b80bcd464f3d844b8040303075a13eabc3599a762c9ac7ab91f4f', // lyn alden
  '1739d937dc8c0c7370aa27585571c1353f3a18bdbe8b7ebecea46519e3b4cef2', // calle
  'c4eabae1be3cf657bc1855ee05e69de9f059cb7a059227168b80b89761cbc4e0', // jack mallers
];

interface SyncStats {
  profiles: number;
  notes: number;
  reactions: number;
  follows: number;
  errors: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncToLocal(pool: SimplePool, events: NostrEvent[]): Promise<number> {
  let synced = 0;
  const batchSize = 50;

  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async (event) => {
        try {
          await pool.publish([LOCAL_RELAY], event);
          synced++;
        } catch {
          // Ignore individual failures
        }
      }),
    );

    // Rate limit
    if (i + batchSize < events.length) {
      await sleep(100);
    }
  }

  return synced;
}

async function fetchUserWot(pool: SimplePool, pubkey: string): Promise<string[]> {
  console.log(`Fetching WoT for ${pubkey.slice(0, 8)}...`);

  // Get user's follow list (kind:3)
  const followEvents = await pool.querySync(SOURCE_RELAYS, {
    kinds: [3],
    authors: [pubkey],
    limit: 1,
  });

  if (followEvents.length === 0) return [];

  const follows = (followEvents[0].tags || [])
    .filter((t) => t[0] === 'p' && t[1])
    .map((t) => t[1]);

  console.log(`Found ${follows.length} follows`);
  return follows;
}

async function syncPubkeyContent(
  pool: SimplePool,
  pubkey: string,
  stats: SyncStats,
): Promise<void> {
  console.log(`Syncing content for ${pubkey.slice(0, 8)}...`);

  try {
    // Fetch profile (kind:0)
    const profiles = await pool.querySync(SOURCE_RELAYS, {
      kinds: [0],
      authors: [pubkey],
      limit: 1,
    });
    if (profiles.length > 0) {
      await syncToLocal(pool, profiles);
      stats.profiles++;
    }

    // Fetch recent notes (kind:1) - last 30 days
    const since = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const notes = await pool.querySync(SOURCE_RELAYS, {
      kinds: [1],
      authors: [pubkey],
      since,
      limit: 100,
    });
    const syncedNotes = await syncToLocal(pool, notes);
    stats.notes += syncedNotes;

    // Fetch follow list (kind:3)
    const follows = await pool.querySync(SOURCE_RELAYS, {
      kinds: [3],
      authors: [pubkey],
      limit: 1,
    });
    if (follows.length > 0) {
      await syncToLocal(pool, follows);
      stats.follows++;
    }

    // Fetch relay list (kind:10002)
    const relayLists = await pool.querySync(SOURCE_RELAYS, {
      kinds: [10002],
      authors: [pubkey],
      limit: 1,
    });
    if (relayLists.length > 0) {
      await syncToLocal(pool, relayLists);
    }
  } catch (error) {
    console.error(`Error syncing ${pubkey.slice(0, 8)}:`, error);
    stats.errors++;
  }
}

async function syncTrendingContent(pool: SimplePool, stats: SyncStats): Promise<void> {
  console.log('Fetching trending content...');

  const since = Math.floor(Date.now() / 1000) - 24 * 60 * 60; // Last 24h

  // Fetch recent notes from major relays
  const notes = await pool.querySync(SOURCE_RELAYS, {
    kinds: [1],
    since,
    limit: 500,
  });

  console.log(`Found ${notes.length} recent notes`);

  // Sync to local
  const synced = await syncToLocal(pool, notes);
  stats.notes += synced;

  // Also fetch reactions to understand popularity
  const noteIds = notes.slice(0, 100).map((n) => n.id);
  if (noteIds.length > 0) {
    const reactions = await pool.querySync(SOURCE_RELAYS, {
      kinds: [7], // reactions
      '#e': noteIds,
      limit: 500,
    });
    const syncedReactions = await syncToLocal(pool, reactions);
    stats.reactions += syncedReactions;
  }
}

async function main(): Promise<void> {
  // Get target pubkey from args or env
  const targetPubkey = process.argv[2] || process.env.OWNER_PUBKEY;

  if (!targetPubkey) {
    console.error('Usage: npx ts-node scripts/populate-relay.ts <pubkey>');
    console.error('Or set OWNER_PUBKEY environment variable');
    process.exit(1);
  }

  console.log('=== Relay Population Script ===');
  console.log(`Local relay: ${LOCAL_RELAY}`);
  console.log(`Target pubkey: ${targetPubkey.slice(0, 16)}...`);
  console.log('');

  const pool = new SimplePool();
  const stats: SyncStats = { profiles: 0, notes: 0, reactions: 0, follows: 0, errors: 0 };

  try {
    // 1. Sync the target user's content
    console.log('--- Phase 1: Target User ---');
    await syncPubkeyContent(pool, targetPubkey, stats);

    // 2. Get and sync WoT (follows)
    console.log('\n--- Phase 2: Web of Trust ---');
    const wot = await fetchUserWot(pool, targetPubkey);

    // Sync first-degree follows (limit to avoid overload)
    const followsToSync = wot.slice(0, 100);
    for (let i = 0; i < followsToSync.length; i++) {
      const pubkey = followsToSync[i];
      console.log(`[${i + 1}/${followsToSync.length}] ${pubkey.slice(0, 8)}...`);
      await syncPubkeyContent(pool, pubkey, stats);
      await sleep(200); // Rate limit
    }

    // 3. Sync notable accounts
    console.log('\n--- Phase 3: Notable Accounts ---');
    for (const pubkey of NOTABLE_PUBKEYS) {
      if (!wot.includes(pubkey)) {
        await syncPubkeyContent(pool, pubkey, stats);
        await sleep(200);
      }
    }

    // 4. Sync trending content
    console.log('\n--- Phase 4: Trending Content ---');
    await syncTrendingContent(pool, stats);

    // Summary
    console.log('\n=== Sync Complete ===');
    console.log(`Profiles: ${stats.profiles}`);
    console.log(`Notes: ${stats.notes}`);
    console.log(`Reactions: ${stats.reactions}`);
    console.log(`Follow lists: ${stats.follows}`);
    console.log(`Errors: ${stats.errors}`);
  } finally {
    pool.close([LOCAL_RELAY, ...SOURCE_RELAYS]);
  }
}

main().catch(console.error);
