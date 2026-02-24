import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader, Share2, Heart, MessageCircle, Clock } from 'lucide-react';
import { Episode } from '../types';
import { api } from '../lib/api';
import { formatRelativeTime } from '../lib/nostr';
import { WotScoreBadge } from '../components/wot/WotScoreBadge';

export function EpisodePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [wotScore, setWotScore] = useState<number | null>(null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    const loadEpisode = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await api.getEpisode(id);
        setEpisode(data);

        // Load WoT score for the author
        try {
          const wotData = await api.getWotScore(data.pubkey);
          setWotScore(wotData.score);
        } catch (err) {
          console.error('Failed to load WoT score:', err);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load episode');
        console.error('Episode load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEpisode();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-nostr-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 text-nostr-purple animate-spin" />
          <p className="text-gray-400">Loading episode...</p>
        </div>
      </div>
    );
  }

  if (error || !episode) {
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
            <p className="text-red-400 text-lg mb-4">{error || 'Episode not found'}</p>
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

        {/* Episode Header */}
        <div className="mb-8">
          {/* Hero Image */}
          {episode.image && (
            <div className="mb-6 -mx-4 px-4">
              <img
                src={episode.image}
                alt={episode.title}
                className="w-full h-96 object-cover rounded-lg"
              />
            </div>
          )}

          {/* Title */}
          <h1 className="text-4xl font-bold text-white mb-4">
            {episode.title}
          </h1>

          {/* Author Info */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-800">
            <img
              src={`https://robohash.org/${episode.pubkey}.png?set=set4&size=48x48`}
              alt="Author"
              className="w-12 h-12 rounded-full"
            />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <p className="text-white font-semibold">{episode.author}</p>
                {wotScore !== null && <WotScoreBadge score={wotScore} compact />}
              </div>
              <p className="text-gray-500 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {formatRelativeTime(episode.createdAt * 1000)}
              </p>
            </div>
          </div>

          {/* Duration and Player Controls */}
          <div className="mb-6 space-y-4">
            <div className="bg-nostr-darker rounded-lg p-4 flex items-center gap-4">
              <div className="text-center">
                <p className="text-gray-400 text-sm">Duration</p>
                <p className="text-2xl font-bold text-white">
                  {Math.floor(episode.duration / 60)}:{String(episode.duration % 60).padStart(2, '0')}
                </p>
              </div>
              <div className="flex-1 h-1 bg-gray-700 rounded-full"></div>
              {episode.mediaUrl && (
                <button className="px-6 py-2 bg-nostr-purple hover:bg-nostr-purple/80 text-white rounded-lg font-semibold">
                  ▶ Play
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          {episode.description && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-3">Description</h2>
              <p className="text-gray-300 text-base leading-relaxed whitespace-pre-wrap">
                {episode.description}
              </p>
            </div>
          )}

          {/* Tags */}
          {episode.tags && episode.tags.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-3">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {episode.tags
                  .filter(tag => tag[0] === 't')
                  .map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-nostr-purple/20 text-nostr-purple rounded-full text-sm hover:bg-nostr-purple/30 cursor-pointer transition-colors"
                    >
                      #{tag[1]}
                    </span>
                  ))}
              </div>
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

          {/* Related Shows */}
          {episode.showId && (
            <div className="bg-nostr-darker border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">From Show</h3>
              <Link
                to={`/show/${episode.showId}`}
                className="text-nostr-purple hover:text-nostr-purple/80 font-medium transition-colors"
              >
                View full show →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
