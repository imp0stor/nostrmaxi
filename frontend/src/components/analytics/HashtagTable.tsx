interface HashtagStat {
  tag: string;
  count: number;
  engagement: number;
}

export function HashtagTable({ hashtags, onTagClick }: { hashtags: HashtagStat[]; onTagClick?: (tag: string) => void }) {
  const maxEngagement = Math.max(1, ...hashtags.map((h) => h.engagement));

  return (
    <div className="space-y-2">
      {hashtags.map((tag, i) => (
        <button
          key={tag.tag}
          type="button"
          onClick={() => onTagClick?.(tag.tag)}
          className="w-full flex items-center gap-3 hover:bg-gray-800/40 active:bg-gray-800/70 rounded px-2 py-2 border border-transparent hover:border-cyan-500/20 transition-all duration-200 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <span className="w-8 text-gray-500 text-sm">{i + 1}</span>
          <span className="text-cyan-400 font-medium w-32">#{tag.tag}</span>
          <div className="flex-1 h-4 bg-gray-800 rounded overflow-hidden border border-gray-700/50">
            <div
              className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded transition-all duration-300"
              style={{ width: `${(tag.engagement / maxEngagement) * 100}%` }}
            />
          </div>
          <span className="text-gray-400 text-sm w-16 text-right">{tag.count} posts</span>
          <span className="text-gray-300 text-sm w-24 text-right">{tag.engagement} engagement</span>
        </button>
      ))}
    </div>
  );
}
