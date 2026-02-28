export function NetworkHealthPanel({ latencyMs, eventsPerMinute }: { latencyMs: number; eventsPerMinute: number }) {
  const latencyPct = Math.max(0, Math.min(100, 100 - latencyMs / 10));
  const throughputPct = Math.max(0, Math.min(100, eventsPerMinute));

  return (
    <div className="cy-card p-5 space-y-4">
      <h3 className="text-white font-semibold">Network Health</h3>
      <div>
        <div className="flex justify-between text-sm text-gray-300 mb-1"><span>Relay latency</span><span>{latencyMs} ms</span></div>
        <div className="h-2 rounded bg-slate-800 overflow-hidden"><div className="h-full bg-cyan-400" style={{ width: `${latencyPct}%` }} /></div>
      </div>
      <div>
        <div className="flex justify-between text-sm text-gray-300 mb-1"><span>Events / minute</span><span>{eventsPerMinute.toFixed(2)}</span></div>
        <div className="h-2 rounded bg-slate-800 overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${throughputPct}%` }} /></div>
      </div>
    </div>
  );
}
