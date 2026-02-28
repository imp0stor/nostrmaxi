import { useMemo } from 'react';
import type { CustomFeedDefinition } from '../../lib/social';

interface FeedDiscoverTabProps {
  feeds: CustomFeedDefinition[];
  userProfile?: { interests?: string[]; following?: string[] };
  onAddFeed: (feed: CustomFeedDefinition) => void;
}

function isValidTitle(title: string): boolean {
  if (!title || title.length < 2) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(title)) return false;
  if (/^[0-9a-f]{20,}$/i.test(title)) return false;
  if (['mute', 'test', 'asdf'].includes(title.toLowerCase())) return false;
  return true;
}

type ScoredFeed = CustomFeedDefinition & { matchScore: number };

export function FeedDiscoverTab({ feeds, userProfile, onAddFeed }: FeedDiscoverTabProps) {
  const scoredFeeds = useMemo<ScoredFeed[]>(() => {
    return feeds
      .filter((feed) => isValidTitle(feed.title))
      .map((feed) => {
        let score = 0;

        if (userProfile?.interests && feed.hashtags) {
          const matchingTopics = feed.hashtags.filter((topic) =>
            userProfile.interests!.some((interest) => interest.toLowerCase().includes(topic.toLowerCase())),
          );
          score += matchingTopics.length * 10;
        }

        if (userProfile?.following && feed.authors) {
          const matchingAuthors = feed.authors.filter((author) => userProfile.following!.includes(author));
          score += matchingAuthors.length * 5;
        }

        if (feed.description) score += 2;

        return { ...feed, matchScore: score };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [feeds, userProfile]);

  const recommended = scoredFeeds.filter((feed) => feed.matchScore > 0);
  const popular = scoredFeeds.filter((feed) => feed.matchScore === 0);

  return (
    <div className="space-y-6">
      {recommended.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-cyan-400 mb-3">✨ Recommended for You</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {recommended.map((feed) => (
              <FeedCard key={`${feed.ownerPubkey || 'local'}:${feed.id}`} feed={feed} onAdd={() => onAddFeed(feed)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-medium text-gray-400 mb-3">Browse Public Feeds</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {popular.map((feed) => (
            <FeedCard key={`${feed.ownerPubkey || 'local'}:${feed.id}`} feed={feed} onAdd={() => onAddFeed(feed)} />
          ))}
        </div>
        {popular.length === 0 && recommended.length === 0 && (
          <p className="text-gray-500 text-sm italic">No public feeds available yet</p>
        )}
      </section>
    </div>
  );
}

function FeedCard({ feed, onAdd }: { feed: ScoredFeed; onAdd: () => void }) {
  return (
    <div className="p-4 rounded-lg border border-gray-700 hover:border-cyan-500/50 bg-gray-800/50 transition">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white truncate">{feed.title}</h4>
          {feed.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{feed.description}</p>}
          {feed.hashtags && feed.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {feed.hashtags.slice(0, 3).map((topic) => (
                <span key={topic} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">#{topic}</span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onAdd}
          className="shrink-0 text-cyan-400 hover:text-cyan-300 text-xl"
          title="Add to my feeds"
        >
          +
        </button>
      </div>
    </div>
  );
}
