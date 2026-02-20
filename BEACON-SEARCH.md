# Beacon Search Integration

This document describes the Beacon Search proxy integration inside NostrMaxi.

## Overview

NostrMaxi proxies search requests to the Beacon Search service, adds a small cache layer, and injects a `nostrmaxi` metadata object into the response. If Beacon is unavailable, NostrMaxi returns a graceful fallback payload and logs the failure.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `BEACON_API_BASE_URL` | `http://10.1.10.143:8090` | Base URL of the Beacon API |
| `BEACON_API_KEY` | (empty) | Optional auth key for Beacon |
| `BEACON_API_KEY_HEADER` | `Authorization` | Header name to send the auth key with |
| `BEACON_API_TIMEOUT_MS` | `7000` | Request timeout in ms |
| `BEACON_SEARCH_CACHE_TTL_MS` | `120000` | Cache TTL in ms for search responses |

> If `BEACON_API_KEY_HEADER=Authorization`, NostrMaxi sends `Authorization: Bearer <key>` unless the key already includes the `Bearer ` prefix.

## API Endpoints

### GET `/api/v1/search`

Query parameters are passed through to Beacon `/api/search`.

**Example**
```bash
curl "http://localhost:3000/api/v1/search?q=nostr&mode=vector&limit=5"
```

### POST `/api/v1/search/filtered`

Body parameters are passed through to Beacon `/api/search/filtered`.

**Example**
```bash
curl -X POST "http://localhost:3000/api/v1/search/filtered" \
  -H "Content-Type: application/json" \
  -d '{
    "q": "nostr",
    "mode": "vector",
    "limit": 5,
    "filters": {
      "kinds": [1, 30023],
      "authors": ["npub1..."]
    }
  }'
```

## Response Shape

NostrMaxi returns Beacon output plus a `nostrmaxi` object with proxy metadata.

```json
{
  "results": [
    {
      "id": "note1...",
      "content": "...",
      "score": 0.83
    }
  ],
  "facets": {
    "kinds": [{"key": "1", "count": 42}]
  },
  "nostrmaxi": {
    "source": "beacon",
    "cache": "miss",
    "beaconAvailable": true,
    "latencyMs": 54,
    "retrievedAt": "2026-02-16T18:50:00.000Z"
  }
}
```

If Beacon is unavailable and no cache entry is found, NostrMaxi returns:

```json
{
  "results": [],
  "nostrmaxi": {
    "source": "fallback",
    "cache": "miss",
    "beaconAvailable": false,
    "latencyMs": 7001,
    "retrievedAt": "2026-02-16T18:52:00.000Z",
    "error": "Beacon responded with 502: ..."
  }
}
```

## Observability

- Logs: Beacon errors are logged as warnings with latency and error message.
- Metrics: `/metrics` includes `nostrmaxi_beacon_search_*` counters and latency gauges.

## Rollout Checklist

1. Set Beacon environment variables (`BEACON_API_BASE_URL`, optional `BEACON_API_KEY`).
2. Restart the NostrMaxi API service.
3. Run a smoke test:
   ```bash
   curl "http://localhost:3000/api/v1/search?q=nostr&limit=2"
   ```
4. Confirm the `nostrmaxi` metadata block is present in the response.
5. Validate metrics output:
   ```bash
   curl "http://localhost:3000/metrics" | grep nostrmaxi_beacon_search
   ```
6. If Beacon requires auth, confirm successful requests in Beacon logs.
