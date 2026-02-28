interface TopPost {
  id: string;
  content: string;
  reactions: number;
  reposts: number;
  zaps: number;
  zapAmount: number;
  score: number;
}

export function TopPostCard({ rank, post }: { rank: number; post: TopPost }) {
  return (
    <div className="flex items-start gap-4 p-3 bg-gray-800/50 rounded-lg">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
          rank === 1
            ? 'bg-yellow-500/20 text-yellow-400'
            : rank === 2
              ? 'bg-gray-400/20 text-gray-300'
              : rank === 3
                ? 'bg-orange-500/20 text-orange-400'
                : 'bg-gray-700 text-gray-400'
        }`}
      >
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-gray-200 line-clamp-2">{post.content}</p>
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
          <span>❤️ {post.reactions}</span>
          <span>🔁 {post.reposts}</span>
          <span>
            ⚡ {post.zaps} ({post.zapAmount} sats)
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold text-cyan-400">{post.score}</div>
        <div className="text-xs text-gray-500">score</div>
      </div>
    </div>
  );
}
