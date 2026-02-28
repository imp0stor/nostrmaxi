import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function TopHashtagsBarChart({ data }: { data: Array<{ tag: string; count: number }> }) {
  return (
    <div className="cy-card p-5">
      <h3 className="text-white font-semibold mb-4">Top Hashtags</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 20 }}>
            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis type="category" dataKey="tag" width={90} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#06b6d4" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
