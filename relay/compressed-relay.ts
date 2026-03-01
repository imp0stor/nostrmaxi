/**
 * Compressed Nostr Relay
 * 
 * Key insight: Nostr events are SIGNED and IMMUTABLE.
 * Therefore: Compress ONCE at ingest, store compressed, serve compressed.
 * 
 * Storage: gzip(event) → blob
 * HTTP API: Serve gzip blobs directly (Content-Encoding: gzip)
 * WebSocket: Standard NIP-01 with permessage-deflate
 * 
 * For bulk retrieval (analytics, sync), use HTTP endpoint:
 *   GET /events?kinds=1,7&since=123&limit=1000
 *   → Returns gzipped JSON array directly (pre-computed)
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { gzipSync, gunzipSync, createGzip } from 'zlib';
import Database from 'better-sqlite3';
import { verifyEvent, type Event as NostrEvent } from 'nostr-tools';

const PORT = Number(process.env.PORT) || 7778;
const DB_PATH = process.env.DB_PATH || './compressed-relay.db';

// Initialize SQLite
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000'); // 64MB cache

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    pubkey TEXT NOT NULL,
    kind INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    tags TEXT NOT NULL,           -- JSON array of tags for filtering
    compressed BLOB NOT NULL,     -- gzipped full event JSON
    size_raw INTEGER NOT NULL,
    size_gzip INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_kind ON events(kind);
  CREATE INDEX IF NOT EXISTS idx_pubkey ON events(pubkey);
  CREATE INDEX IF NOT EXISTS idx_created ON events(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_kind_created ON events(kind, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_pubkey_kind ON events(pubkey, kind);
`);

// Pre-compiled statements for speed
const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO events (id, pubkey, kind, created_at, tags, compressed, size_raw, size_gzip)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const countStmt = db.prepare(`SELECT COUNT(*) as count FROM events`);
const statsStmt = db.prepare(`SELECT SUM(size_raw) as raw, SUM(size_gzip) as gzip FROM events`);

interface Filter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  '#p'?: string[];
  '#e'?: string[];
  [key: string]: unknown;
}

function storeEvent(event: NostrEvent): { ok: boolean; message?: string; duplicate?: boolean } {
  try {
    // Verify signature
    if (!verifyEvent(event)) {
      return { ok: false, message: 'invalid: bad signature' };
    }

    const raw = JSON.stringify(event);
    const compressed = gzipSync(raw, { level: 9 }); // Max compression

    const result = insertStmt.run(
      event.id,
      event.pubkey,
      event.kind,
      event.created_at,
      JSON.stringify(event.tags),
      compressed,
      raw.length,
      compressed.length
    );

    return { ok: true, duplicate: result.changes === 0 };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}

function buildQuery(filter: Filter): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.ids?.length) {
    conditions.push(`id IN (${filter.ids.map(() => '?').join(',')})`);
    params.push(...filter.ids);
  }
  if (filter.authors?.length) {
    conditions.push(`pubkey IN (${filter.authors.map(() => '?').join(',')})`);
    params.push(...filter.authors);
  }
  if (filter.kinds?.length) {
    conditions.push(`kind IN (${filter.kinds.map(() => '?').join(',')})`);
    params.push(...filter.kinds);
  }
  if (filter.since !== undefined) {
    conditions.push(`created_at >= ?`);
    params.push(filter.since);
  }
  if (filter.until !== undefined) {
    conditions.push(`created_at <= ?`);
    params.push(filter.until);
  }
  // Tag filters (simplified - checks if tag exists in JSON)
  if (filter['#p']?.length) {
    conditions.push(`(${filter['#p'].map(() => `tags LIKE ?`).join(' OR ')})`);
    params.push(...filter['#p'].map(p => `%"p","${p}"%`));
  }
  if (filter['#e']?.length) {
    conditions.push(`(${filter['#e'].map(() => `tags LIKE ?`).join(' OR ')})`);
    params.push(...filter['#e'].map(e => `%"e","${e}"%`));
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = `LIMIT ${Math.min(filter.limit || 500, 10000)}`;

  return {
    sql: `SELECT compressed FROM events ${where} ORDER BY created_at DESC ${limit}`,
    params,
  };
}

function queryEventsRaw(filter: Filter): Buffer[] {
  const { sql, params } = buildQuery(filter);
  const rows = db.prepare(sql).all(...params) as { compressed: Buffer }[];
  return rows.map(r => r.compressed);
}

function queryEvents(filter: Filter): NostrEvent[] {
  return queryEventsRaw(filter).map(buf => JSON.parse(gunzipSync(buf).toString()));
}

// HTTP Server - serves pre-gzipped content
const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept-Encoding');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health / Stats
  if (url.pathname === '/health' || url.pathname === '/') {
    const { count } = countStmt.get() as { count: number };
    const { raw, gzip } = statsStmt.get() as { raw: number; gzip: number };
    const ratio = raw ? ((1 - gzip / raw) * 100).toFixed(1) : '0';
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'Compressed Nostr Relay',
      description: 'Pre-gzipped storage - compress once, serve fast',
      events: count,
      storage: {
        raw_mb: (raw / 1024 / 1024).toFixed(2),
        compressed_mb: (gzip / 1024 / 1024).toFixed(2),
        compression_ratio: ratio + '%'
      },
      endpoints: ['/events', '/event/:id', '/health']
    }, null, 2));
    return;
  }

  // Single event by ID
  if (url.pathname.startsWith('/event/')) {
    const id = url.pathname.slice(7);
    const row = db.prepare('SELECT compressed FROM events WHERE id = ?').get(id) as { compressed: Buffer } | undefined;
    
    if (!row) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Event not found' }));
      return;
    }

    const acceptsGzip = req.headers['accept-encoding']?.includes('gzip');
    if (acceptsGzip) {
      // Serve pre-compressed blob directly - ZERO decompression!
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
        'X-Storage': 'pre-compressed'
      });
      res.end(row.compressed);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(gunzipSync(row.compressed));
    }
    return;
  }

  // Bulk events query
  if (url.pathname === '/events') {
    const filter: Filter = {};
    
    if (url.searchParams.has('kinds')) {
      filter.kinds = url.searchParams.get('kinds')!.split(',').map(Number);
    }
    if (url.searchParams.has('authors')) {
      filter.authors = url.searchParams.get('authors')!.split(',');
    }
    if (url.searchParams.has('since')) {
      filter.since = Number(url.searchParams.get('since'));
    }
    if (url.searchParams.has('until')) {
      filter.until = Number(url.searchParams.get('until'));
    }
    if (url.searchParams.has('limit')) {
      filter.limit = Number(url.searchParams.get('limit'));
    }

    const events = queryEvents(filter);
    const acceptsGzip = req.headers['accept-encoding']?.includes('gzip');

    if (acceptsGzip) {
      const gzipped = gzipSync(JSON.stringify(events));
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
        'X-Event-Count': String(events.length)
      });
      res.end(gzipped);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(events));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// WebSocket for NIP-01 compatibility
const wss = new WebSocketServer({ server, perMessageDeflate: true });

wss.on('connection', (ws: WebSocket) => {
  const subs = new Map<string, Filter[]>();

  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());
      const [type, ...args] = msg;

      if (type === 'EVENT') {
        const event = args[0] as NostrEvent;
        const result = storeEvent(event);
        ws.send(JSON.stringify(['OK', event.id, result.ok, result.message || '']));
      } 
      else if (type === 'REQ') {
        const [subId, ...filters] = args;
        subs.set(subId, filters);
        
        for (const filter of filters) {
          const events = queryEvents(filter);
          for (const evt of events) {
            ws.send(JSON.stringify(['EVENT', subId, evt]));
          }
        }
        ws.send(JSON.stringify(['EOSE', subId]));
      }
      else if (type === 'CLOSE') {
        subs.delete(args[0]);
      }
    } catch (err) {
      console.error('WS error:', err);
    }
  });
});

server.listen(PORT, () => {
  const { count } = countStmt.get() as { count: number };
  const { raw, gzip } = (statsStmt.get() || { raw: 0, gzip: 0 }) as { raw: number; gzip: number };
  
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           COMPRESSED NOSTR RELAY - Pre-gzip Storage            ║
╠════════════════════════════════════════════════════════════════╣
║  • Events stored gzipped (level 9) - compress ONCE             ║
║  • HTTP /event/:id serves pre-compressed blob directly         ║  
║  • HTTP /events for bulk queries with gzip response            ║
║  • WebSocket NIP-01 compatible with permessage-deflate         ║
╚════════════════════════════════════════════════════════════════╝

Port: ${PORT}
Events: ${count.toLocaleString()}
Storage: ${(raw/1024/1024).toFixed(2)} MB raw → ${(gzip/1024/1024).toFixed(2)} MB compressed
`);
});
