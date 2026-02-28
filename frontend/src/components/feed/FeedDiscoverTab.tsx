import { useEffect, useMemo, useState } from 'react';
import { loadFeedForCustomDefinition, type CustomFeedDefinition, type FeedItem } from '../../lib/social';

interface FeedDiscoverTabProps {
  feeds: CustomFeedDefinition[];
  userProfile?: { interests?: string[]; following?: string[]; pubkey?: string };
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

interface FeedCardProps {
  feed: ScoredFeed;
  onAdd: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  previewPosts?: FeedItem[];
  loadingPreview: boolean;
}

export function FeedDiscoverTab({ feeds, userProfile, onAddFeed }: FeedDiscoverTabProps) {
  const [expandedFeedId, setExpandedFeedId] = useState<string | null>(null);
  const [previewPosts, setPreviewPosts] = useState<Map<string, FeedItem[]>>(new Map());
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

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

  const loadFeedPreview = async (feed: CustomFeedDefinition) => {
    const feedId = feed.id;
    if (previewPosts.has(feedId)) return;

    setLoadingPreview(feedId);

    try {
      const contextPubkey = userProfile?.pubkey || feed.ownerPubkey || '';
      const result = await loadFeedForCustomDefinition(contextPubkey, feed);
      setPreviewPosts((prev) => new Map(prev).set(feedId, result.items.slice(0, 5)));
    } catch (err) {
      console.error('Failed to load feed preview:', err);
      setPreviewPosts((prev) => new Map(prev).set(feedId, []));
    } finally {
      setLoadingPreview((current) => (current === feedId ? null : current));
    }
  };

  useEffect(() => {
    if (!expandedFeedId) return;

    const feed = [...recommended, ...popular].find((candidate) => candidate.id === expandedFeedId);
    if (feed) {
      void loadFeedPreview(feed);
    }
  }, [expandedFeedId, recommended, popular]);

  return (
    <div className="space-y-6">
      {recommended.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-cyan-400 mb-3">✨ Recommended for You</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {recommended.map((feed) => (
              <FeedCard
                key={`${feed.ownerPubkey || 'local'}:${feed.id}`}
                feed={feed}
                onAdd={() => onAddFeed(feed)}
                expanded={expandedFeedId === feed.id}
                onToggleExpand={() => setExpandedFeedId(expandedFeedId === feed.id ? null : feed.id)}
                previewPosts={previewPosts.get(feed.id)}
                loadingPreview={loadingPreview === feed.id}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-medium text-gray-400 mb-3">Browse Public Feeds</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {popular.map((feed) => (
            <FeedCard
              key={`${feed.ownerPubkey || 'local'}:${feed.id}`}
              feed={feed}
              onAdd={() => onAddFeed(feed)}
              expanded={expandedFeedId === feed.id}
              onToggleExpand={() => setExpandedFeedId(expandedFeedId === feed.id ? null : feed.id)}
              previewPosts={previewPosts.get(feed.id)}
              loadingPreview={loadingPreview === feed.id}
            />
          ))}
        </div>
        {popular.length === 0 && recommended.length === 0 && (
          <p className="text-gray-500 text-sm italic">No public feeds available yet</p>
        )}
      </section>
    </div>
  );
}

function CompactPostPreview({ item }: { item: FeedItem }) {
  const displayName = item.profile?.display_name || item.profile?.name || 'Unknown';
  const hasImage = item.content?.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/i);

  return (
    <div className="p-2 rounded bg-gray-800/70 border border-gray-700/50 space-y-1">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-gray-600 overflow-hidden">
          {item.profile?.picture && (
            <img src={item.profile.picture} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <span className="text-xs font-medium text-cyan-300 truncate">{displayName}</span>
        <span className="text-xs text-gray-500">{new Date(item.created_at * 1000).toLocaleDateString()}</span>
      </div>

      <p className="text-xs text-gray-300 line-clamp-2">
        {item.content?.replace(/https?:\/\/[^\s]+/g, '[link]').slice(0, 200)}
      </p>

      {hasImage && <div className="text-xs text-gray-500">📷 Has image</div>}
    </div>
  );
}

function FeedCard({ feed, onAdd, expanded, onToggleExpand, previewPosts, loadingPreview }: FeedCardProps) {
  return (
    <div
      className={`rounded-lg border bg-gray-800/50 transition-all ${
        expanded ? 'border-cyan-500/50 sm:col-span-2' : 'border-gray-700 hover:border-cyan-500/30'
      }`}
    >
      <div className="p-4 cursor-pointer" onClick={onToggleExpand}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-white truncate">{feed.title}</h4>
              <span className="text-gray-500 text-xs">{expanded ? '▼' : '▶'}</span>
            </div>
            {feed.description && !expanded && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-1">{feed.description}</p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="shrink-0 px-3 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-sm"
          >
            + Add
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-700/50 pt-3 space-y-3">
          {feed.description && <p className="text-sm text-gray-300">{feed.description}</p>}

          <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Feed Design</p>

            {feed.hashtags && feed.hashtags.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-500 w-16 shrink-0">Topics:</span>
                <div className="flex flex-wrap gap-1">
                  {feed.hashtags.map((topic) => (
                    <span key={topic} className="text-xs bg-cyan-900/30 text-cyan-300 px-2 py-0.5 rounded">
                      #{topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {feed.authors && feed.authors.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-500 w-16 shrink-0">Authors:</span>
                <div className="flex flex-wrap gap-1">
                  {feed.authors.slice(0, 5).map((author) => (
                    <span key={author} className="text-xs bg-purple-900/30 text-purple-300 px-2 py-0.5 rounded font-mono">
                      {author.slice(0, 8)}...
                    </span>
                  ))}
                  {feed.authors.length > 5 && (
                    <span className="text-xs text-gray-500">+{feed.authors.length - 5} more</span>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-16 shrink-0">Replies:</span>
              <span className="text-xs text-gray-300">{feed.includeReplies ? 'Included' : 'Excluded'}</span>
            </div>

            {feed.ownerPubkey && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-16 shrink-0">Created by:</span>
                <span className="text-xs text-gray-300 font-mono">{feed.ownerPubkey.slice(0, 12)}...</span>
              </div>
            )}
          </div>

          <div className="mt-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Content Preview</p>
            {loadingPreview ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                Loading preview...
              </div>
            ) : previewPosts && previewPosts.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {previewPosts.slice(0, 3).map((item) => (
                  <CompactPostPreview key={item.id} item={item} />
                ))}
                {previewPosts.length > 3 && (
                  <p className="text-xs text-gray-500 text-center">+{previewPosts.length - 3} more posts</p>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-500 italic p-3 bg-gray-800/30 rounded text-center">
                No preview available — feed may have no recent content
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
