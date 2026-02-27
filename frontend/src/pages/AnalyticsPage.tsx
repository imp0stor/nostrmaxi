import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AnalyticsScope, loadAnalyticsDashboard } from '../lib/analytics';

const SCOPE_STORAGE_KEY = 'nostrmaxi.analytics.scope';

function scopeLabel(scope: AnalyticsScope): string {
  return scope === 'wot' ? 'WoT (Your Network)' : 'Global (All Nostr)';
}

function Sparkline({ points, color = '#00d4ff' }: { points: number[]; color?: string }) {
  const max = Math.max(1, ...points);
  const path = points
    .map((value, i) => `${(i / Math.max(1, points.length - 1)) * 100},${100 - ((value / max) * 100)}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 100" className="w-full h-14">
      <polyline fill="none" stroke={color} strokeWidth="4" points={path} />
    </svg>
  );
}

export function AnalyticsPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<AnalyticsScope>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(SCOPE_STORAGE_KEY) : null;
    return stored === 'wot' ? 'wot' : 'global';
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    loadAnalyticsDashboard(user.pubkey, scope)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [user, scope]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SCOPE_STORAGE_KEY, scope);
    }
  }, [scope]);

  const insight = useMemo(() => {
    if (scope === 'wot') return 'Trending in your network: trusted follows + 2nd degree voices.';
    return 'Trending globally: full Nostr stream and broad network momentum.';
  }, [scope]);

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="cy-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="cy-kicker">ANALYTICS COMMAND CENTER</p>
            <h1 className="cy-title">Nostr Intelligence Dashboard</h1>
            <p className="text-blue-200 mt-2">{insight}</p>
          </div>
          <div className="inline-flex border border-cyan-800">
            {(['global', 'wot'] as AnalyticsScope[]).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-4 py-2 text-sm transition ${scope === s ? 'bg-cyan-500/20 text-cyan-100 shadow-[0_0_20px_rgba(0,212,255,0.35)]' : 'text-blue-200 hover:text-cyan-200'}`}
              >
                {s === 'global' ? 'Global' : 'WoT'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-blue-300">
          <span>Active scope: <strong className="text-cyan-200">{scopeLabel(scope)}</strong></span>
          <button
            className="cy-btn-secondary"
            onClick={() => {
              if (!data) return;
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `nostrmaxi-analytics-${scope}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export JSON
          </button>
        </div>
      </div>

      {loading && <div className="cy-card p-6 text-cyan-200">Loading analytics…</div>}
      {error && <div className="cy-card p-6 text-red-300">{error}</div>}

      {data && (
        <>
          <div className="grid lg:grid-cols-5 gap-4">
            <Metric title="Followers" value={String(data.profile.followerGrowth.at(-1)?.value ?? 0)} series={data.profile.followerGrowth.map((p: any) => p.value)} color="#00d4ff" />
            <Metric title="Engagement" value={`${data.profile.engagementRate.at(-1)?.value ?? 0}%`} series={data.profile.engagementRate.map((p: any) => p.value)} color="#34d399" />
            <Metric title="Reach" value={String(data.profile.reachEstimate.at(-1)?.value ?? 0)} series={data.profile.reachEstimate.map((p: any) => p.value)} color="#60a5fa" />
            <Metric title="Profile views" value={String(data.profile.profileViews.at(-1)?.value ?? 0)} series={data.profile.profileViews.map((p: any) => p.value)} color="#f472b6" />
            <Metric title="Network size" value={String(data.network.networkGrowth.at(-1)?.value ?? 0)} series={data.network.networkGrowth.map((p: any) => p.value)} color="#a78bfa" />
          </div>

          <section className="grid xl:grid-cols-2 gap-4">
            <ChartCard title={scope === 'wot' ? 'Trending in your network' : 'Trending globally'}>
              <BarList rows={data.content.hashtagEngagement.map((h: any) => ({ label: h.hashtag, value: h.value }))} />
            </ChartCard>
            <ChartCard title="Top posts by zaps/reactions">
              <div className="space-y-2">
                {data.profile.topPosts.map((post: any) => (
                  <div key={post.id} className="cy-panel p-3 text-sm">
                    <div className="text-cyan-100">{post.preview}</div>
                    <div className="text-blue-300 text-xs mt-1">⚡ {post.zaps} zaps · ❤ {post.reactions} reactions · Score {post.score}</div>
                  </div>
                ))}
              </div>
            </ChartCard>
            <ChartCard title="Content type performance">
              <Donut rows={data.content.contentTypePerformance.map((d: any) => ({ label: d.type, value: d.value }))} />
            </ChartCard>
            <ChartCard title="Best posting times">
              <BarList rows={data.content.bestPostingTimes.map((h: any) => ({ label: h.hour, value: h.score }))} />
            </ChartCard>
            <ChartCard title="Relay performance">
              <BarList rows={data.relay.relayPerformance.map((r: any) => ({ label: r.relay.replace('wss://', ''), value: Math.round(r.uptime) }))} suffix="% uptime" />
            </ChartCard>
            <ChartCard title="Influential connections">
              <BarList rows={data.network.influentialConnections.map((c: any) => ({ label: c.pubkey.slice(0, 14), value: c.influence }))} />
            </ChartCard>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ title, value, series, color }: { title: string; value: string; series: number[]; color: string }) {
  return (
    <div className="cy-card p-4">
      <p className="cy-kicker">{title}</p>
      <p className="text-2xl text-cyan-100 mt-2">{value}</p>
      <Sparkline points={series} color={color} />
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="cy-card p-5">
      <h2 className="text-cyan-200 font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function BarList({ rows, suffix = '' }: { rows: { label: string; value: number }[]; suffix?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="text-xs text-blue-200 flex justify-between"><span>{row.label}</span><span>{row.value}{suffix ? ` ${suffix}` : ''}</span></div>
          <div className="h-2 bg-blue-950/80 mt-1">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-700" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Donut({ rows }: { rows: { label: string; value: number }[] }) {
  const total = Math.max(1, rows.reduce((sum, r) => sum + r.value, 0));
  let acc = 0;
  const colors = ['#00d4ff', '#34d399', '#a78bfa', '#f472b6', '#60a5fa'];
  return (
    <div className="flex items-center gap-4">
      <svg width="180" height="180" viewBox="0 0 42 42">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#11254d" strokeWidth="7" />
        {rows.map((row, idx) => {
          const pct = (row.value / total) * 100;
          const node = (
            <circle
              key={row.label}
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke={colors[idx % colors.length]}
              strokeWidth="7"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={-acc}
              transform="rotate(-90 21 21)"
            />
          );
          acc += pct;
          return node;
        })}
      </svg>
      <div className="space-y-1 text-sm">
        {rows.map((row, idx) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="inline-block w-2 h-2" style={{ backgroundColor: colors[idx % colors.length] }} />
            <span className="text-blue-200">{row.label}: {row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
