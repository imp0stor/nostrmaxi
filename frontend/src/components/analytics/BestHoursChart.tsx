export function BestHoursChart({ hours }: { hours: { hour: number; engagement: number }[] }) {
  const maxEngagement = Math.max(0, ...hours.map((h) => h.engagement));
  const topHours = [...hours].sort((a, b) => b.engagement - a.engagement).slice(0, 3);

  return (
    <div>
      <h4 className="text-sm text-gray-400 mb-3">Best Hours</h4>
      <div className="flex items-end gap-1 h-32">
        {Array.from({ length: 24 }, (_, hour) => {
          const data = hours.find((h) => h.hour === hour);
          const engagement = data?.engagement || 0;
          const height = maxEngagement > 0 ? (engagement / maxEngagement) * 100 : 0;
          const isTop = topHours.some((h) => h.hour === hour);

          return (
            <div
              key={hour}
              className="flex-1 flex flex-col items-center"
              title={`${hour}:00 - ${engagement.toFixed(1)} avg engagement`}
            >
              <div
                className={`w-full rounded-t transition-all ${isTop ? 'bg-cyan-500' : 'bg-gray-600'}`}
                style={{ height: `${height}%`, minHeight: engagement > 0 ? '4px' : '0' }}
              />
              {hour % 6 === 0 && <span className="text-xs text-gray-500 mt-1">{hour}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
