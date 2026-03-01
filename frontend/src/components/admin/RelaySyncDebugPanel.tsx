import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

export type RelayDebugState = {
  backoffUntil: number;
  retryCount: number;
  targetRpm: number;
  successStreak: number;
  consecutive429: number;
  quarantinedUntil: number;
  lastRequestAt: number;
  lastSuccessAt: number;
  lastRateErrorAt: number;
};

export type RelayDebugRow = {
  relay: string;
  state: RelayDebugState;
  effectiveAvailability: number;
};

type RelayDebugResponse = {
  relays: RelayDebugRow[];
};

export type RelayFilter = 'all' | 'backoff' | 'quarantine';

export function filterRelayRows(rows: RelayDebugRow[], filter: RelayFilter, now = Date.now()): RelayDebugRow[] {
  if (filter === 'backoff') {
    return rows.filter((row) => row.state.backoffUntil > now);
  }

  if (filter === 'quarantine') {
    return rows.filter((row) => row.state.quarantinedUntil > now);
  }

  return rows;
}

function fmtTimestamp(ts: number): string {
  if (!ts || ts <= 0) return '—';
  return new Date(ts).toLocaleString();
}

function fmtCountdown(ts: number, now: number): string {
  if (!ts || ts <= now) return '—';
  const seconds = Math.max(0, Math.ceil((ts - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remSeconds}s`;
  }
  return `${remSeconds}s`;
}

async function fetchRelaySyncDebug(): Promise<RelayDebugResponse> {
  const token = api.getToken();
  const response = await fetch('/api/v1/relay-sync/debug', {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Relay sync debug request failed (${response.status})`);
  }

  return response.json();
}

export function RelaySyncDebugPanel() {
  const [rows, setRows] = useState<RelayDebugRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RelayFilter>('all');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(0);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchRelaySyncDebug();
      const sorted = [...(data.relays || [])].sort((a, b) => b.effectiveAvailability - a.effectiveAvailability || a.relay.localeCompare(b.relay));
      setRows(sorted);
      setLastRefreshedAt(Date.now());
    } catch (err) {
      setError((err as Error).message || 'Failed to load relay sync debug data');
    } finally {
      setLoading(false);
      setNow(Date.now());
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(() => filterRelayRows(rows, filter, now), [rows, filter, now]);

  return (
    <div className="space-y-3">
      <div className="cy-card p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-orange-100">Relay Sync Adaptive Limiter Debug</h2>
            <p className="text-xs text-orange-200/80">Ordered by health score / effective availability.</p>
          </div>
          <button className="cy-chip" onClick={() => void load()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {(['all', 'backoff', 'quarantine'] as const).map((option) => (
            <button
              key={option}
              className={`cy-chip ${filter === option ? 'border-orange-300/80 text-orange-100 shadow-[0_0_16px_rgba(249,115,22,0.28)]' : ''}`}
              onClick={() => {
                setFilter(option);
                setNow(Date.now());
              }}
            >
              {option === 'all' ? 'All relays' : option === 'backoff' ? 'In backoff' : 'In quarantine'}
            </button>
          ))}
          <span className="text-xs text-orange-200/80">Showing {visibleRows.length} of {rows.length}</span>
        </div>

        {lastRefreshedAt ? <p className="text-[11px] text-orange-300/70">Last refreshed: {fmtTimestamp(lastRefreshedAt)}</p> : null}
        {error ? <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
      </div>

      <div className="cy-card p-3 overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="text-left text-orange-200/80">
              <th className="pb-2 pr-3">Relay</th>
              <th className="pb-2 pr-3">Target RPM</th>
              <th className="pb-2 pr-3">Health score</th>
              <th className="pb-2 pr-3">Backoff</th>
              <th className="pb-2 pr-3">Quarantine</th>
              <th className="pb-2 pr-3">Recent errors</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr className="border-t border-white/10">
                <td colSpan={6} className="py-4 text-orange-200/70">
                  {loading ? 'Loading relay states…' : 'No relay states match the selected filter.'}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const inBackoff = row.state.backoffUntil > now;
                const inQuarantine = row.state.quarantinedUntil > now;
                return (
                  <tr key={row.relay} className="border-t border-white/10 align-top">
                    <td className="py-2 pr-3 font-mono text-xs text-orange-100">{row.relay}</td>
                    <td className="py-2 pr-3">{row.state.targetRpm}</td>
                    <td className="py-2 pr-3">{row.effectiveAvailability}</td>
                    <td className="py-2 pr-3">
                      {inBackoff ? (
                        <div className="space-y-0.5">
                          <div className="text-orange-100">{fmtCountdown(row.state.backoffUntil, now)}</div>
                          <div className="text-[11px] text-orange-300/70">until {fmtTimestamp(row.state.backoffUntil)}</div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      {inQuarantine ? (
                        <div className="space-y-0.5">
                          <div className="text-red-200">{fmtCountdown(row.state.quarantinedUntil, now)}</div>
                          <div className="text-[11px] text-red-300/80">until {fmtTimestamp(row.state.quarantinedUntil)}</div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <div>429 streak: {row.state.consecutive429}</div>
                      <div>Retries: {row.state.retryCount}</div>
                      <div className="text-[11px] text-orange-300/70">Last rate error: {fmtTimestamp(row.state.lastRateErrorAt)}</div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
