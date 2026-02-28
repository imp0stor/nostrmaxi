import type { FeedDefinition } from '../../hooks/useOnboarding';

interface Props {
  feeds: { selected: string[]; available: FeedDefinition[] };
  onToggleFeed: (feedId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function OnboardingFeeds({ feeds, onToggleFeed, onNext, onBack }: Props) {
  return (
    <section className="cy-card p-6 space-y-4">
      <h2 className="text-xl text-cyan-100 font-semibold">Pick your feeds</h2>
      <p className="text-sm text-gray-300">Subscribe to curated channels powered by our feed generation system.</p>

      <div className="grid gap-3 max-h-[52vh] overflow-y-auto pr-1">
        {feeds.available.map((feed) => {
          const selected = feeds.selected.includes(feed.id);
          return (
            <button
              key={feed.id}
              className={`text-left rounded-lg border p-4 ${selected ? 'border-cyan-400 bg-cyan-500/10' : 'border-cyan-500/20 bg-slate-950/60'}`}
              onClick={() => onToggleFeed(feed.id)}
            >
              <div className="flex items-center justify-between">
                <p className="text-cyan-100 font-semibold">{feed.name}</p>
                <p className="text-xs text-cyan-300">{feed.subscriberCount.toLocaleString()} subscribers</p>
              </div>
              <p className="text-sm text-gray-300 mt-1">{feed.description}</p>
              {feed.samplePosts[0] ? (
                <div className="mt-2 text-xs text-gray-400 border-l-2 border-cyan-500/30 pl-2">
                  “{feed.samplePosts[0].content}”
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between">
        <button className="cy-btn-secondary" onClick={onBack}>Back</button>
        <div className="flex gap-2">
          <button className="cy-btn-secondary" onClick={onNext}>Skip</button>
          <button className="cy-btn" onClick={onNext}>Continue ({feeds.selected.length})</button>
        </div>
      </div>
    </section>
  );
}
