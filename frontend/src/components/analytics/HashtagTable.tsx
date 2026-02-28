interface HashtagStat {
  tag: string;
  count: number;
  engagement: number;
}

export function HashtagTable({ hashtags }: { hashtags: HashtagStat[] }) {
  const maxEngagement = Math.max(1, ...hashtags.map((h) => h.engagement));

  return (
    <div className="space-y-2">
      {hashtags.map((tag, i) => (
        <div key={tag.tag} className="flex items-center gap-3">
          <span className="w-8 text-gray-500 text-sm">{i + 1}</span>
          <span className="text-cyan-400 font-medium w-32">#{tag.tag}</span>
          <div className="flex-1 h-4 bg-gray-800 rounded overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded"
              style={{ width: `${(tag.engagement / maxEngagement) * 100}%` }}
            />
          </div>
          <span className="text-gray-400 text-sm w-16 text-right">{tag.count} posts</span>
          <span className="text-gray-300 text-sm w-24 text-right">{tag.engagement} engagement</span>
        </div>
      ))}
    </div>
  );
}
