import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function ActivityTimelineChart({
  data,
  xKey,
}: {
  data: Array<{ hour?: string; date?: string; count: number }>;
  xKey: 'hour' | 'date';
}) {
  return (
    <div className="cy-card p-5">
      <h3 className="text-white font-semibold mb-4">Activity Timeline</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey={xKey} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(value) => String(value).slice(5, 16)} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
