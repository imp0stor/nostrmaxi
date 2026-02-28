export function BestDaysChart({ days }: { days: { day: string; engagement: number }[] }) {
  const maxEngagement = Math.max(0, ...days.map((d) => d.engagement));

  return (
    <div>
      <h4 className="text-sm text-gray-400 mb-3">Best Days</h4>
      <div className="space-y-2">
        {days.map((day) => (
          <div key={day.day} className="flex items-center gap-3">
            <span className="w-12 text-sm text-gray-300">{day.day}</span>
            <div className="flex-1 h-3 bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full rounded bg-gradient-to-r from-cyan-600 to-cyan-400"
                style={{ width: `${maxEngagement > 0 ? (day.engagement / maxEngagement) * 100 : 0}%` }}
              />
            </div>
            <span className="w-14 text-right text-sm text-gray-400">{day.engagement.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
