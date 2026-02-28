import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface TimelineDataPoint {
  date: string;
  posts: number;
}

export function PostingActivityChart({ data }: { data: TimelineDataPoint[] }) {
  return (
    <div className="cy-card p-5">
      <h3 className="text-lg font-semibold text-white mb-4">Posting Activity</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
          <YAxis stroke="#6b7280" fontSize={12} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
            labelStyle={{ color: '#9ca3af' }}
          />
          <Bar dataKey="posts" fill="#22d3ee" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
