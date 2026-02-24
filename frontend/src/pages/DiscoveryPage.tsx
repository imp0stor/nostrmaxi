import { useState } from 'react';
import { Compass, Search, Filter, Lightbulb, Clock } from 'lucide-react';
import { api } from '../lib/api';

interface SearchResult {
  id: string;
  title?: string;
  content: string;
  author: string;
  type: 'episode' | 'show' | 'note' | 'product' | 'bounty' | 'qa';
  timestamp: number;
  author_avatar?: string;
}

const CONTENT_TYPES = [
  { id: 'episode', label: '🎙️ Episodes', description: 'Audio & video content' },
  { id: 'show', label: '📺 Shows', description: 'Podcast & series' },
  { id: 'note', label: '📝 Notes', description: 'Articles & thoughts' },
  { id: 'product', label: '🛍️ Products', description: 'Goods & services' },
  { id: 'bounty', label: '💰 Bounties', description: 'Tasks & rewards' },
  { id: 'qa', label: '❓ Q&A', description: 'Questions & answers' },
];

const TRENDING_TAGS = [
  '#nostr',
  '#bitcoin',
  '#lightning',
  '#freedom',
  '#decentralization',
  '#privacy',
  '#damus',
  '#amethyst',
  '#nostrica',
];

export function DiscoveryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['note', 'episode', 'show']);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const handleSearch = async (query: string = searchQuery) => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    try {
      setSearching(true);
      setError(null);
      setHasSearched(true);

      const data = await api.searchContent(query, 50);
      // Filter by selected types if needed
      const filtered = data.filter((item: any) =>
        selectedTypes.length === 0 || selectedTypes.includes(item.type)
      );
      setResults(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const toggleContentType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleTagClick = (tag: string) => {
    setSelectedTag(tag);
    setSearchQuery(tag.substring(1)); // Remove # for search
    setResults([]);
    setHasSearched(false);
  };

  return (
    <div className="min-h-screen bg-nostr-dark">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Compass className="w-8 h-8 text-nostr-purple" />
            <h1 className="text-4xl font-bold text-white">Discover</h1>
          </div>
          <p className="text-gray-400 text-lg">
            Explore content across Nostr. Search, browse, and discover creators you love.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search for content, creators, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-12 pr-4 py-3 bg-nostr-darker border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-nostr-purple"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={searching || !searchQuery.trim()}
              className="px-6 py-3 bg-nostr-purple hover:bg-nostr-purple/80 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Content Type Filter */}
        <div className="mb-8 bg-nostr-darker border border-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter by Content Type
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {CONTENT_TYPES.map(ct => (
              <button
                key={ct.id}
                onClick={() => toggleContentType(ct.id)}
                className={`p-3 rounded-lg text-center transition-all ${
                  selectedTypes.includes(ct.id)
                    ? 'bg-nostr-purple text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <div className="font-semibold text-sm">{ct.label}</div>
                <div className="text-xs text-gray-500 mt-1">{ct.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Search Results / Main Content */}
          <div className="lg:col-span-2">
            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {hasSearched && searchQuery && (
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Results for &quot;{searchQuery}&quot;
                </h2>
                <p className="text-gray-400">
                  {results.length} result{results.length !== 1 ? 's' : ''} found
                </p>
              </div>
            )}

            {results.length === 0 && hasSearched && searchQuery && !searching && (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg mb-4">No results found</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setHasSearched(false);
                    setResults([]);
                  }}
                  className="px-6 py-2 bg-nostr-purple hover:bg-nostr-purple/80 text-white rounded-lg font-medium"
                >
                  Clear Search
                </button>
              </div>
            )}

            {/* Search Results Grid */}
            <div className="space-y-4">
              {results.map((result, idx) => (
                <div key={idx} className="bg-nostr-darker rounded-lg border border-gray-800 p-4 hover:border-gray-700 transition-colors">
                  <div className="flex items-start gap-4">
                    {result.author_avatar && (
                      <img
                        src={result.author_avatar}
                        alt={result.author}
                        className="w-12 h-12 rounded-full flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-nostr-purple/20 text-nostr-purple text-xs rounded font-semibold">
                          {result.type.toUpperCase()}
                        </span>
                      </div>
                      {result.title && (
                        <h4 className="text-white font-semibold mb-1 line-clamp-2">
                          {result.title}
                        </h4>
                      )}
                      <p className="text-gray-400 text-sm line-clamp-2 mb-2">
                        {result.content}
                      </p>
                      <p className="text-xs text-gray-500">
                        By {result.author} • {new Date(result.timestamp * 1000).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            {!hasSearched && results.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Compass className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Start exploring</p>
                <p className="text-sm">Use the search bar or browse trending tags</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Trending Tags */}
            <div className="bg-nostr-darker border border-gray-800 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                Trending Tags
              </h3>
              <div className="space-y-2">
                {TRENDING_TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleTagClick(tag)}
                    className={`block w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedTag === tag
                        ? 'bg-nostr-purple text-white'
                        : 'text-nostr-purple hover:bg-gray-800'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent */}
            <div className="bg-nostr-darker border border-gray-800 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Recently Added
              </h3>
              <p className="text-sm text-gray-400">
                New content is being added constantly. Check back often for fresh discoveries!
              </p>
            </div>

            {/* Beacon Integration Placeholder */}
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-800 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-2">🔔 Beacon Discovery</h3>
              <p className="text-sm text-gray-300 mb-4">
                Smart content recommendations powered by machine learning (coming in Phase E)
              </p>
              <button disabled className="w-full px-4 py-2 bg-purple-900/40 text-purple-300 rounded-lg text-sm font-medium disabled:opacity-50 cursor-not-allowed">
                Enable Beacon → (Phase E)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
