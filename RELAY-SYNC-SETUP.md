# Relay Sync Setup Guide

The Relay Sync Service automatically populates a local Nostr relay with events from public relays. This enables:

- Complete analytics datasets (all user zaps, reactions, replies)
- Faster queries (local relay vs network queries)
- Offline-capable analytics
- Historical data archival

## Quick Start

### 1. Set Up Local Relay

Install and run a Nostr relay:

**Option A: nostr-rs-relay (Rust)**
```bash
git clone https://github.com/scsibug/nostr-rs-relay
cd nostr-rs-relay
cargo build --release
./target/release/nostr-rs-relay
```

**Option B: strfry (C++)**
```bash
git clone https://github.com/hoytech/strfry
cd strfry
make setup-golpe
make
./strfry relay
```

**Option C: Docker**
```bash
docker run -d --name nostr-relay \
  -p 7777:8080 \
  scsibug/nostr-rs-relay
```

### 2. Configure Sync Service

Add to `.env`:

```env
# Enable relay sync
RELAY_SYNC_ENABLED=true

# Local relay URL
LOCAL_RELAY_URL=ws://localhost:7777

# Source relays to sync from
RELAY_SYNC_SOURCES=wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol,wss://relay.primal.net

# Sync every 5 minutes
RELAY_SYNC_INTERVAL_MS=300000

# Sync strategy (recent, wot, popular, all)
RELAY_SYNC_STRATEGY=recent

# For WoT strategy: comma-separated pubkeys
RELAY_SYNC_WOT_PUBKEYS=<your_pubkey>,<other_pubkeys>

# How far back to sync (days)
RELAY_SYNC_SINCE_DAYS=30
```

### 3. Start Backend

```bash
npm run start:dev
```

The sync service will:
1. Start automatically on app init
2. Run initial sync immediately
3. Schedule periodic syncs every `RELAY_SYNC_INTERVAL_MS`

### 4. Monitor Sync Status

```bash
# Get sync stats
curl http://localhost:3000/api/v1/relay-sync/stats

# Manual trigger
curl -X POST http://localhost:3000/api/v1/relay-sync/trigger
```

## Sync Strategies

### `recent` (Default, Recommended)
- Syncs recent events from all public relays
- Best for general-purpose analytics
- Storage: ~5-10GB for 30 days

### `wot` (Web of Trust)
- Only syncs events from configured pubkeys + their network
- Best for focused user analytics
- Storage: ~1-3GB for 30 days
- **Requires**: `RELAY_SYNC_WOT_PUBKEYS` set

### `popular`
- Syncs events likely to be popular (zaps, reposts)
- Best for trending content discovery
- Storage: ~3-7GB for 30 days

### `all`
- Syncs everything (⚠️ use with caution)
- Best for comprehensive archival
- Storage: ~20-50GB for 30 days

## Storage Requirements

| Strategy | 7 days | 14 days | 30 days |
|----------|--------|---------|---------|
| recent   | 2GB    | 4GB     | 8GB     |
| wot      | 500MB  | 1GB     | 2GB     |
| popular  | 1.5GB  | 3GB     | 6GB     |
| all      | 8GB    | 16GB    | 40GB    |

## Performance Tuning

### Sync Interval
```env
# More frequent (higher network usage, fresher data)
RELAY_SYNC_INTERVAL_MS=60000  # 1 minute

# Less frequent (lower network usage, staler data)
RELAY_SYNC_INTERVAL_MS=900000 # 15 minutes
```

### Historical Depth
```env
# Shorter window (less storage, faster syncs)
RELAY_SYNC_SINCE_DAYS=7

# Longer window (more storage, slower syncs)
RELAY_SYNC_SINCE_DAYS=90
```

### Source Relays
```env
# More relays = more complete data, but slower syncs
RELAY_SYNC_SOURCES=wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol,wss://relay.primal.net,wss://nostr.mom

# Fewer relays = faster syncs, but less complete
RELAY_SYNC_SOURCES=wss://relay.damus.io,wss://relay.primal.net
```

## Production Deployment

### Operator Setup

1. **Start local relay on Operator**:
```bash
ssh neo@10.1.10.143
cd ~/nostrmaxi-production
docker run -d --name nostr-relay -p 7777:8080 --restart unless-stopped scsibug/nostr-rs-relay
```

2. **Configure backend `.env`**:
```env
RELAY_SYNC_ENABLED=true
LOCAL_RELAY_URL=ws://10.1.10.143:7777
RELAY_SYNC_STRATEGY=wot
RELAY_SYNC_WOT_PUBKEYS=<user_pubkey>
```

3. **Restart backend**:
```bash
docker compose restart backend
```

### Monitoring

Check logs:
```bash
docker compose logs -f backend | grep RelaySyncService
```

Expected output:
```
[RelaySyncService] Relay sync enabled: ws://10.1.10.143:7777 ← 4 sources (wot strategy)
[RelaySyncService] Starting sync (wot strategy)...
[RelaySyncService] Fetched 247 unique events
[RelaySyncService] Sync complete: 247/247 published in 3421ms (total: 247, errors: 0)
```

## Troubleshooting

### Relay Won't Connect
```bash
# Test relay connectivity
websocat ws://localhost:7777
# Should see connection open

# Check relay logs
docker logs nostr-relay
```

### Sync Not Running
```bash
# Check if enabled
curl http://localhost:3000/api/v1/relay-sync/stats

# Manual trigger
curl -X POST http://localhost:3000/api/v1/relay-sync/trigger
```

### High Error Rate
Check backend logs for specific errors:
```bash
docker compose logs backend | grep "RelaySyncService.*error"
```

Common issues:
- Source relay down → Remove from `RELAY_SYNC_SOURCES`
- Local relay full → Increase storage or reduce `SINCE_DAYS`
- Rate limiting → Increase `SYNC_INTERVAL_MS`

## API Reference

### GET `/api/v1/relay-sync/stats`

Returns:
```json
{
  "totalEvents": 1247,
  "lastSyncAt": 1709045123000,
  "lastSyncDurationMs": 2341,
  "errors": 0
}
```

### POST `/api/v1/relay-sync/trigger`

Triggers manual sync (asynchronous).

Returns:
```json
{
  "message": "Sync triggered"
}
```

## Integration with Analytics

Once sync is running, analytics will automatically use the local relay for complete datasets:

```typescript
// Analytics will query local relay for comprehensive data
const analytics = await loadAnalyticsDashboard(pubkey);
console.log(analytics.summary.totalSatsReceived); // Now accurate!
```

## Next Steps

1. ✅ Set up local relay
2. ✅ Configure sync service
3. ✅ Start backend
4. ✅ Monitor sync status
5. 🚀 Analytics now have complete data!

For issues or questions, check logs or open an issue on GitHub.
