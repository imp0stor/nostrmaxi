import { filterRelayRows, type RelayDebugRow } from '../src/components/admin/RelaySyncDebugPanel';

describe('RelaySyncDebugPanel helpers', () => {
  const now = 1_700_000_000_000;
  const rows: RelayDebugRow[] = [
    {
      relay: 'wss://relay-a.example',
      effectiveAvailability: 4100,
      state: {
        backoffUntil: now + 30_000,
        retryCount: 1,
        targetRpm: 41,
        successStreak: 0,
        consecutive429: 1,
        quarantinedUntil: 0,
        lastRequestAt: now - 5000,
        lastSuccessAt: now - 10_000,
        lastRateErrorAt: now - 2000,
      },
    },
    {
      relay: 'wss://relay-b.example',
      effectiveAvailability: -1_100_000,
      state: {
        backoffUntil: 0,
        retryCount: 4,
        targetRpm: 10,
        successStreak: 0,
        consecutive429: 4,
        quarantinedUntil: now + 60_000,
        lastRequestAt: now - 5000,
        lastSuccessAt: now - 60_000,
        lastRateErrorAt: now - 1000,
      },
    },
    {
      relay: 'wss://relay-c.example',
      effectiveAvailability: 5200,
      state: {
        backoffUntil: 0,
        retryCount: 0,
        targetRpm: 52,
        successStreak: 3,
        consecutive429: 0,
        quarantinedUntil: 0,
        lastRequestAt: now - 1000,
        lastSuccessAt: now - 1000,
        lastRateErrorAt: 0,
      },
    },
  ];

  test('returns all rows for all filter', () => {
    expect(filterRelayRows(rows, 'all', now)).toHaveLength(3);
  });

  test('filters only rows currently in backoff', () => {
    const filtered = filterRelayRows(rows, 'backoff', now);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].relay).toBe('wss://relay-a.example');
  });

  test('filters only rows currently in quarantine', () => {
    const filtered = filterRelayRows(rows, 'quarantine', now);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].relay).toBe('wss://relay-b.example');
  });
});
