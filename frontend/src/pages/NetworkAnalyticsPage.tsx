import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityTimelineChart } from '../components/analytics/ActivityTimelineChart';
import { EventKindDonutChart } from '../components/analytics/EventKindDonutChart';
import { TopHashtagsBarChart } from '../components/analytics/TopHashtagsBarChart';
import { NetworkHealthPanel } from '../components/analytics/NetworkHealthPanel';

const API_BASE = (typeof process !== 'undefined' && (process as any).env?.VITE_API_URL) || '/api/v1';

type Snapshot = {
  computedAt: string;
  totalEvents: number;
  eventsByKind: Record<string, number>;
  hourlyEvents: Array<{ hour: string; count: number }>;
  dailyEvents: Array<{ date: string; count: number }>;
  activeUsersHour: number;
  activeUsersDay: number;
  activeUsersWeek: number;
  totalZapSats: string;
  zapCount: number;
  avgZapSats: number;
  topZappedPosts: Array<{ eventId: string; sats: number; author?: string }>;
  topHashtags: Array<{ tag: string; count: number }>;
  mediaPostCount: number;
  relayLatencyMs: number;
  eventsPerMinute: number;
};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`Failed to load network analytics (${response.status})`);
  return response.json() as Promise<T>;
}

export function NetworkAnalyticsPage() {
  const [timelineMode, setTimelineMode] = useState<'hourly' | 'daily'>('hourly');

  const latestQuery = useQuery({
    queryKey: ['network-analytics', 'latest'],
    queryFn: () => fetchJson<Snapshot>('/analytics/network'),
    refetchInterval: 60_000,
  });

  const drillDownQuery = useQuery({
    queryKey: ['network-analytics', 'zaps'],
    queryFn: () => fetchJson<{ metric: string; data: any }>('/analytics/network/drill-down/zaps?live=true'),
    refetchInterval: 60_000,
  });

  const snapshot = latestQuery.data;

  const eventKindData = useMemo(
    () =>
      snapshot
        ? Object.entries(snapshot.eventsByKind)
            .map(([kind, count]) => ({ kind: `kind ${kind}`, count }))
            .sort((a, b) => b.count - a.count)
        : [],
    [snapshot],
  );

  if (latestQuery.isLoading) {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-gray-300">Loading network analytics…</div>;
  }

  if (latestQuery.isError || !snapshot) {
    return <div className="max-w-6xl mx-auto px-4 py-8 text-red-300">Failed to load network analytics.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Global Network Analytics</h1>
          <p className="text-slate-400">Relay-wide pulse for NostrMaxi.</p>
        </div>
        <p className="text-xs text-slate-400">Last updated: {new Date(snapshot.computedAt).toLocaleString()}</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="cy-card p-5"><p className="text-sm text-slate-400">Total Events</p><p className="text-3xl text-cyan-300 font-bold">{snapshot.totalEvents.toLocaleString()}</p></div>
        <div className="cy-card p-5"><p className="text-sm text-slate-400">Active Users (24h)</p><p className="text-3xl text-cyan-300 font-bold">{snapshot.activeUsersDay.toLocaleString()}</p></div>
        <div className="cy-card p-5"><p className="text-sm text-slate-400">Zap Volume</p><p className="text-3xl text-cyan-300 font-bold">{Number(snapshot.totalZapSats).toLocaleString()} sats</p></div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EventKindDonutChart data={eventKindData} />
        <div className="space-y-3">
          <div className="cy-card p-3 inline-flex gap-2">
            <button className={`px-3 py-1 rounded text-sm ${timelineMode === 'hourly' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`} onClick={() => setTimelineMode('hourly')}>Hourly</button>
            <button className={`px-3 py-1 rounded text-sm ${timelineMode === 'daily' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`} onClick={() => setTimelineMode('daily')}>Daily</button>
          </div>
          <ActivityTimelineChart data={timelineMode === 'hourly' ? snapshot.hourlyEvents : snapshot.dailyEvents} xKey={timelineMode === 'hourly' ? 'hour' : 'date'} />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopHashtagsBarChart data={snapshot.topHashtags} />
        <div className="space-y-6">
          <NetworkHealthPanel latencyMs={snapshot.relayLatencyMs} eventsPerMinute={snapshot.eventsPerMinute} />
          <div className="cy-card p-5">
            <h3 className="text-white font-semibold mb-3">Zap Leaderboard</h3>
            <div className="space-y-2 max-h-72 overflow-auto">
              {(drillDownQuery.data?.data?.topZappedPosts || snapshot.topZappedPosts).map((row: any, index: number) => (
                <details key={`${row.eventId}-${index}`} className="rounded border border-slate-700 bg-slate-900/50 p-3">
                  <summary className="cursor-pointer text-sm text-slate-200">#{index + 1} {row.sats.toLocaleString()} sats</summary>
                  <p className="text-xs text-slate-400 mt-2 break-all">Event: {row.eventId}</p>
                  {row.author && <p className="text-xs text-slate-400 break-all">Author: {row.author}</p>}
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
