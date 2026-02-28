import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#06b6d4', '#22d3ee', '#0891b2', '#155e75', '#67e8f9', '#0e7490'];

export function EventKindDonutChart({ data }: { data: Array<{ kind: string; count: number }> }) {
  return (
    <div className="cy-card p-5">
      <h3 className="text-white font-semibold mb-4">Event Distribution</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="kind" innerRadius={65} outerRadius={95} paddingAngle={2}>
              {data.map((entry, index) => (
                <Cell key={entry.kind} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => Number(value ?? 0).toLocaleString()} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
