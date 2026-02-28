import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface TrendPoint {
  date: string;
  posts: number;
  reactions: number;
  reposts: number;
  zaps: number;
  zapAmount: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  metric: 'posts' | 'reactions' | 'reposts' | 'zaps' | 'zapAmount';
  previousData?: TrendPoint[];
  height?: number;
}

export function TrendChart({ data, metric, previousData, height = 260 }: TrendChartProps) {
  const previousMap = new Map((previousData ?? []).map((p) => [p.date, p]));
  const merged = data.map((point) => ({
    ...point,
    previous: previousMap.get(point.date)?.[metric] ?? null,
  }));

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={merged} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="rgba(45, 64, 99, 0.45)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: '#9ac0ff', fontSize: 11 }} axisLine={{ stroke: '#21406f' }} tickLine={false} />
          <YAxis tick={{ fill: '#9ac0ff', fontSize: 11 }} axisLine={{ stroke: '#21406f' }} tickLine={false} width={40} />
          <Tooltip
            contentStyle={{
              background: 'rgba(10, 15, 26, 0.95)',
              border: '1px solid rgba(0, 212, 255, 0.35)',
              borderRadius: 10,
              color: '#cffafe',
            }}
            labelStyle={{ color: '#7dd3fc' }}
          />
          {previousData && (
            <Line
              type="monotone"
              dataKey="previous"
              stroke="#4b89b9"
              strokeDasharray="5 5"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          )}
          <Line
            type="monotone"
            dataKey={metric}
            stroke="#00d4ff"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 4, stroke: '#00d4ff', fill: '#0a0f1a' }}
            animationDuration={350}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
