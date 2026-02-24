import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader, Share2, Heart, MessageCircle, Clock, Play } from 'lucide-react';
import { Show, Episode } from '../types';
import { api } from '../lib/api';
import { formatRelativeTime } from '../lib/nostr';
import { WotScoreBadge } from '../components/wot/WotScoreBadge';

export function ShowPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [show, setShow] = useState<Show | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [wotScore, setWotScore] = useState<number | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [episodePage, setEpisodePage] = useState(0);
  const [hasMoreEpisodes, setHasMoreEpisodes] = useState(true);

  const episodesPerPage = 10;

  useEffect(() => {
    const loadShow = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await api.getShow(id);
        setShow(data);

        // Load WoT score for the author
        try {
          const wotData = await api.getWotScore(data.pubkey);
          setWotScore(wotData.score);
        } catch (err) {
          console.error('Failed to load WoT score:', err);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load show');
        console.error('Show load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadShow();
  }, [id]);

  // Load episodes
  useEffect(() => {
    const loadEpisodes = async () => {
      if (!id) return;
      try {
        const data = await api.getShowEpisodes(id, episodesPerPage, episodePage * episodesPerPage);
        setEpisodes(prev => episodePage === 0 ? data.episodes : [...prev, ...data.episodes]);
        setHasMoreEpisodes(data.episodes.length === episodesPerPage);
      } catch (err) {
        console.error('Failed to load episodes:', err);
      }
    };

    loadEpisodes();
  }, [id, episodePage]);

  if (loading) {
    return (
      <div className="min-h-screen bg-nostr-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 text-nostr-purple animate-spin" />
          <p className="text-gray-400">Loading show...</p>
        </div>
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="min-h-screen bg-nostr-dark">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white mb-8"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
            <p className="text-red-400 text-lg mb-4">{error || 'Show not found'}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-nostr-purple hover:bg-nostr-purple/80 text-white rounded-lg font-medium"
            >
              Back to Feed
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nostr-dark">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Go Back
        </button>

        {/* Show Header */}
        <div className="mb-8">
          {/* Hero Image */}
          {show.image && (
            <div className="mb-6 -mx-4 px-4">
              <img
                src={show.image}
                alt={show.title}
                className="w-full h-96 object-cover rounded-lg"
              />
            </div>
          )}

          {/* Title */}
          <h1 className="text-4xl font-bold text-white mb-4">
            {show.title}
          </h1>

          {/* Author Info */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-800">
            <img
              src={`https://robohash.org/${show.pubkey}.png?set=set4&size=48x48`}
              alt="Author"
              className="w-12 h-12 rounded-full"
            />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <p className="text-white font-semibold">{show.author}</p>
                {wotScore !== null && <WotScoreBadge score={wotScore} compact />}
              </div>
              <p className="text-gray-500 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {formatRelativeTime(show.createdAt * 1000)}
              </p>
            </div>
          </div>

          {/* Description */}
          {show.description && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-3">About</h2>
              <p className="text-gray-300 text-base leading-relaxed whitespace-pre-wrap">
                {show.description}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setLiked(!liked)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                liked
                  ? 'bg-red-900/30 text-red-400'
                  : 'bg-nostr-darker text-gray-400 hover:text-red-400 border border-gray-800'
              }`}
            >
              <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
              Like
            </button>

            <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-nostr-darker text-gray-400 hover:text-nostr-purple border border-gray-800 transition-colors">
              <MessageCircle className="w-5 h-5" />
              Reply
            </button>

            <div className="relative">
              <button
                onClick={() => setShowShare(!showShare)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-nostr-darker text-gray-400 hover:text-nostr-purple border border-gray-800 transition-colors"
              >
                <Share2 className="w-5 h-5" />
                Share
              </button>

              {showShare && (
                <div className="absolute right-0 mt-2 w-48 bg-nostr-darker border border-gray-700 rounded-lg shadow-lg py-2 z-10">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      setShowShare(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white text-sm"
                  >
                    Copy link
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Episodes Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Episodes ({episodes.length})</h2>
          </div>

          {episodes.length === 0 ? (
            <div className="text-center py-8 bg-nostr-darker rounded-lg border border-gray-800">
              <p className="text-gray-400">No episodes yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {episodes.map((episode) => (
                <Link
                  key={episode.id}
                  to={`/episode/${episode.id}`}
                  className="block bg-nostr-darker hover:border-nostr-purple border border-gray-800 rounded-lg p-4 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {episode.image && (
                      <img
                        src={episode.image}
                        alt={episode.title}
                        className="w-20 h-20 object-cover rounded flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-white font-semibold line-clamp-2">
                          {episode.title}
                        </h3>
                        <span className="flex-shrink-0 px-2 py-1 bg-nostr-purple/20 text-nostr-purple text-xs rounded">
                          {Math.floor(episode.duration / 60)}m
                        </span>
                      </div>
                      {episode.description && (
                        <p className="text-gray-400 text-sm line-clamp-2 mb-2">
                          {episode.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        {formatRelativeTime(episode.createdAt * 1000)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        // Play episode
                      }}
                      className="flex-shrink-0 w-10 h-10 bg-nostr-purple hover:bg-nostr-purple/80 rounded-full flex items-center justify-center transition-colors"
                    >
                      <Play className="w-5 h-5 text-white fill-current" />
                    </button>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Load More Episodes */}
          {hasMoreEpisodes && episodes.length > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setEpisodePage(prev => prev + 1)}
                className="px-6 py-2 bg-nostr-darker hover:bg-gray-700 border border-gray-800 text-white rounded-lg font-medium transition-colors"
              >
                Load More Episodes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
