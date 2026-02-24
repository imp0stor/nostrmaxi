import { useState } from 'react';
import { Heart, MessageCircle, Share2, Clock } from 'lucide-react';
import { FeedItem } from '../../types';
import { formatRelativeTime } from '../../lib/nostr';
import { WotScoreBadge } from '../wot/WotScoreBadge';

interface FeedCardProps {
  item: FeedItem;
  onAuthorClick?: (pubkey: string) => void;
}

export function FeedCard({ item, onAuthorClick }: FeedCardProps) {
  const [liked, setLiked] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const contentTypeLabel = () => {
    switch (item.kind) {
      case 30023: return 'Article';
      case 34235: return 'Episode';
      case 1: return 'Note';
      case 7: return 'Like';
      default: return 'Content';
    }
  };

  const getContentPreview = () => {
    const maxLength = 300;
    if (item.content.length > maxLength) {
      return item.content.substring(0, maxLength) + '...';
    }
    return item.content;
  };

  return (
    <div className="bg-nostr-darker rounded-lg border border-gray-800 p-6 hover:border-gray-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <img
            src={`https://robohash.org/${item.pubkey}.png?set=set4&size=40x40`}
            alt="Author avatar"
            className="w-10 h-10 rounded-full cursor-pointer hover:opacity-80"
            onClick={() => onAuthorClick?.(item.pubkey)}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold text-white truncate">
                {item.pubkey.slice(0, 8)}...
              </p>
              {item.wotScore !== undefined && (
                <WotScoreBadge score={item.wotScore} compact />
              )}
              {item.isLikelyBot && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-900/20 text-red-400 text-xs rounded">
                  🤖 Bot
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(item.createdAt * 1000)}
            </p>
          </div>
        </div>

        {/* Content type badge */}
        <span className="px-2.5 py-1 bg-nostr-purple/20 text-nostr-purple text-xs font-medium rounded-full whitespace-nowrap ml-2">
          {contentTypeLabel()}
        </span>
      </div>

      {/* Title */}
      {item.title && (
        <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">
          {item.title}
        </h3>
      )}

      {/* Image */}
      {item.image && (
        <div className="mb-4 -mx-6 px-6">
          <img
            src={item.image}
            alt={item.title || 'Content image'}
            className="w-full h-48 object-cover rounded-lg"
          />
        </div>
      )}

      {/* Summary/Content preview */}
      <p className="text-gray-300 text-sm mb-4 line-clamp-3">
        {item.summary || getContentPreview()}
      </p>

      {/* Duration badge for episodes */}
      {item.duration && (
        <div className="mb-4 flex items-center gap-2">
          <span className="px-2 py-1 bg-gray-800 text-gray-400 text-xs rounded">
            ⏱️ {Math.floor(item.duration / 60)}m {item.duration % 60}s
          </span>
        </div>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {item.tags.slice(0, 3).map((tag, idx) => {
            if (tag[0] === 't') {
              return (
                <span key={idx} className="text-xs text-nostr-purple hover:text-nostr-purple/80 cursor-pointer">
                  #{tag[1]}
                </span>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-800">
        <button
          onClick={() => setLiked(!liked)}
          className={`flex items-center gap-2 text-sm transition-colors ${
            liked
              ? 'text-red-500'
              : 'text-gray-500 hover:text-red-500'
          }`}
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
          <span className="text-xs">Like</span>
        </button>

        <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-nostr-purple transition-colors">
          <MessageCircle className="w-4 h-4" />
          <span className="text-xs">Reply</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setShareOpen(!shareOpen)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-nostr-purple transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-xs">Share</span>
          </button>

          {shareOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-nostr-dark border border-gray-700 rounded-lg shadow-lg py-2 z-10">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(item.url || item.id);
                  setShareOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white text-sm"
              >
                Copy link
              </button>
              <a
                href={`https://nostr.band/?q=%23${item.id.slice(0, 8)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white text-sm"
              >
                View on Nostr
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
