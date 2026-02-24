import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, Share2, Heart, MessageCircle, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { formatRelativeTime } from '../lib/nostr';
import { WotScoreBadge } from '../components/wot/WotScoreBadge';

interface ContentNote {
  id: string;
  title?: string;
  content: string;
  author: string;
  pubkey: string;
  createdAt: number;
  tags: string[][];
  image?: string;
}

export function NotePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<ContentNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [wotScore, setWotScore] = useState<number | null>(null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    const loadNote = async () => {
      if (!id) return;
      try {
        setLoading(true);
        // Fetch note via content search/detail endpoint
        const response = await api.searchContent(id, 1);
        if (response && response.length > 0) {
          setNote(response[0]);

          // Load WoT score
          try {
            const wotData = await api.getWotScore(response[0].pubkey);
            setWotScore(wotData.score);
          } catch (err) {
            console.error('Failed to load WoT score:', err);
          }
        } else {
          setError('Note not found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load note');
      } finally {
        setLoading(false);
      }
    };

    loadNote();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-nostr-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 text-nostr-purple animate-spin" />
          <p className="text-gray-400">Loading note...</p>
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="min-h-screen bg-nostr-dark">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white mb-8"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
            <p className="text-red-400 text-lg mb-4">{error || 'Note not found'}</p>
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
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Go Back
        </button>

        {/* Note Content */}
        <article className="bg-nostr-darker border border-gray-800 rounded-lg p-8 mb-8">
          {/* Image if present */}
          {note.image && (
            <div className="mb-6">
              <img
                src={note.image}
                alt="Note illustration"
                className="w-full h-96 object-cover rounded-lg"
              />
            </div>
          )}

          {/* Title */}
          {note.title && (
            <h1 className="text-4xl font-bold text-white mb-6">
              {note.title}
            </h1>
          )}

          {/* Author Info */}
          <div className="flex items-center gap-4 mb-8 pb-8 border-b border-gray-800">
            <img
              src={`https://robohash.org/${note.pubkey}.png?set=set4&size=48x48`}
              alt="Author"
              className="w-12 h-12 rounded-full"
            />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <p className="text-white font-semibold">{note.author}</p>
                {wotScore !== null && <WotScoreBadge score={wotScore} compact />}
              </div>
              <p className="text-gray-500 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {formatRelativeTime(note.createdAt * 1000)}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="prose prose-invert max-w-none mb-8">
            <p className="text-gray-300 text-lg leading-relaxed whitespace-pre-wrap break-words">
              {note.content}
            </p>
          </div>

          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <div className="mb-8 pt-8 border-t border-gray-800">
              <div className="flex flex-wrap gap-2">
                {note.tags
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
          <div className="flex gap-4 pt-8 border-t border-gray-800">
            <button
              onClick={() => setLiked(!liked)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                liked
                  ? 'bg-red-900/30 text-red-400'
                  : 'bg-gray-800 text-gray-400 hover:text-red-400'
              }`}
            >
              <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
              Like
            </button>

            <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-gray-800 text-gray-400 hover:text-nostr-purple transition-colors">
              <MessageCircle className="w-5 h-5" />
              Reply
            </button>

            <div className="relative">
              <button
                onClick={() => setShowShare(!showShare)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-gray-800 text-gray-400 hover:text-nostr-purple transition-colors"
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
        </article>
      </div>
    </div>
  );
}
