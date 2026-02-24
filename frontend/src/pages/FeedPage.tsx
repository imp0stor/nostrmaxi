import { useState, useEffect } from 'react';
import { Loader, Filter, Search, RotateCcw } from 'lucide-react';
import { FeedItem } from '../types';
import { api } from '../lib/api';
import { FeedCard } from '../components/feed/FeedCard';

interface FeedFilters {
  contentTypes: string[];
  filterMode: 'wot' | 'genuine' | 'firehose';
  wotDepth: number;
  sortBy: 'newest' | 'oldest' | 'popular' | 'trending';
  searchQuery?: string;
}

const DEFAULT_FILTERS: FeedFilters = {
  contentTypes: ['episode', 'show', 'note'],
  filterMode: 'genuine',
  wotDepth: 2,
  sortBy: 'newest',
};

const CONTENT_TYPES = [
  { id: 'episode', label: '🎙️ Episodes' },
  { id: 'show', label: '📺 Shows' },
  { id: 'note', label: '📝 Notes' },
  { id: 'product', label: '🛍️ Products' },
  { id: 'bounty', label: '💰 Bounties' },
  { id: 'qa', label: '❓ Q&A' },
];

const FILTER_MODES = [
  { id: 'firehose', label: 'All', description: 'See everything' },
  { id: 'genuine', label: 'Genuine', description: 'Filter bots & spam' },
  { id: 'wot', label: 'Web of Trust', description: 'Only trusted users' },
];

export function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalItems, setTotalItems] = useState(0);

  const itemsPerPage = 20;

  // Load feed
  const loadFeed = async (pageNum: number = 0, reset: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.getFeed({
        contentTypes: filters.contentTypes,
        filter: filters.filterMode,
        wotDepth: filters.wotDepth,
        sortBy: filters.sortBy,
        limit: itemsPerPage,
        offset: pageNum * itemsPerPage,
      });

      const newItems = response.items || [];
      
      if (reset) {
        setItems(newItems);
      } else {
        setItems(prev => [...prev, ...newItems]);
      }

      setTotalItems(response.total || 0);
      setHasMore(newItems.length === itemsPerPage);
      
      if (reset) {
        setPage(0);
      } else {
        setPage(pageNum);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
      console.error('Feed load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load initial feed
  useEffect(() => {
    loadFeed(0, true);
  }, [filters]);

  // Handle filter changes
  const toggleContentType = (contentType: string) => {
    setFilters(prev => ({
      ...prev,
      contentTypes: prev.contentTypes.includes(contentType)
        ? prev.contentTypes.filter(ct => ct !== contentType)
        : [...prev.contentTypes, contentType],
    }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      loadFeed(page + 1);
    }
  };

  return (
    <div className="min-h-screen bg-nostr-dark">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Your Feed</h1>
          <p className="text-gray-400">
            {totalItems > 0 ? `${totalItems} items` : 'Personalized content from your network'}
          </p>
        </div>

        {/* Search and Filter Bar */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search feed..."
                value={filters.searchQuery || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 bg-nostr-darker border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-nostr-purple"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                showFilters
                  ? 'bg-nostr-purple text-white'
                  : 'bg-nostr-darker border border-gray-800 text-gray-300 hover:border-gray-700'
              }`}
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-nostr-darker border border-gray-800 rounded-lg p-6 space-y-6">
              {/* Filter Mode Selection */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Content Filter</h3>
                <div className="grid grid-cols-3 gap-2">
                  {FILTER_MODES.map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => setFilters(prev => ({ ...prev, filterMode: mode.id as any }))}
                      className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                        filters.filterMode === mode.id
                          ? 'bg-nostr-purple text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                      title={mode.description}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Type Selection */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Content Types</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {CONTENT_TYPES.map(ct => (
                    <button
                      key={ct.id}
                      onClick={() => toggleContentType(ct.id)}
                      className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                        filters.contentTypes.includes(ct.id)
                          ? 'bg-nostr-purple text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* WoT Depth Slider */}
              {filters.filterMode === 'wot' && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Trust Network Depth</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={filters.wotDepth}
                        onChange={(e) => setFilters(prev => ({ ...prev, wotDepth: parseInt(e.target.value) }))}
                        className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-white font-semibold min-w-fit">{filters.wotDepth}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {filters.wotDepth === 1 && 'Direct follows only'}
                      {filters.wotDepth === 2 && 'Direct follows + their follows'}
                      {filters.wotDepth === 3 && 'Up to 3 degrees of separation'}
                      {filters.wotDepth === 4 && 'Up to 4 degrees of separation'}
                      {filters.wotDepth === 5 && 'Up to 5 degrees of separation'}
                    </p>
                  </div>
                </div>
              )}

              {/* Sort By Selection */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Sort By</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(['newest', 'oldest', 'popular', 'trending'] as const).map(sort => (
                    <button
                      key={sort}
                      onClick={() => setFilters(prev => ({ ...prev, sortBy: sort }))}
                      className={`p-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                        filters.sortBy === sort
                          ? 'bg-nostr-purple text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {sort}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset Button */}
              <button
                onClick={resetFilters}
                className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset to Defaults
              </button>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => loadFeed(0, true)}
              className="mt-2 px-4 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-300 rounded font-medium"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && items.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No items found</p>
            <p className="text-gray-500 text-sm mt-2">Try adjusting your filters</p>
            <button
              onClick={resetFilters}
              className="mt-4 px-4 py-2 bg-nostr-purple hover:bg-nostr-purple/80 text-white rounded-lg font-medium"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Feed Items */}
        <div className="space-y-6">
          {items.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>

        {/* Load More Button */}
        {hasMore && items.length > 0 && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-8 py-3 bg-nostr-purple hover:bg-nostr-purple/80 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && items.length === 0 && (
          <div className="flex justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader className="w-8 h-8 text-nostr-purple animate-spin" />
              <p className="text-gray-400">Loading feed...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
