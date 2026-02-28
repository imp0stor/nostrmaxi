import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SimplePool } from 'nostr-tools';
import type { NostrEvent } from '../types';
import { FALLBACK_RELAYS } from '../lib/relayConfig';
import { fetchProfilesBatchCached, profileDisplayName } from '../lib/profileCache';
import { encodeNpub, truncateNpub } from '../lib/nostr';
import { parseZapReceipt } from '../lib/zaps';
import { Avatar } from './Avatar';

interface PostModalProps {
  eventId: string | null;
  isOpen: boolean;
  onClose: () => void;
  initialMetrics?: {
    reactions: number;
    reposts: number;
    replies: number;
    zaps: number;
    zapSats: number;
  };
}

interface EngagementMetrics {
  reactions: number;
  reposts: number;
  replies: number;
  zaps: number;
  zapSats: number;
}

const EMPTY_METRICS: EngagementMetrics = {
  reactions: 0,
  reposts: 0,
  replies: 0,
  zaps: 0,
  zapSats: 0,
};

export function PostModal({ eventId, isOpen, onClose, initialMetrics }: PostModalProps) {
  const [event, setEvent] = useState<NostrEvent | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [metrics, setMetrics] = useState<EngagementMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !eventId) return;

    const load = async () => {
      setLoading(true);
      setMetrics(initialMetrics ?? EMPTY_METRICS);
      try {
        const pool = new SimplePool();
        const [noteEvents, reactionEvents, replyEvents, repostEvents, zapEvents] = await Promise.all([
          pool.querySync(FALLBACK_RELAYS, { ids: [eventId], limit: 1 }) as Promise<NostrEvent[]>,
          pool.querySync(FALLBACK_RELAYS, { kinds: [7], '#e': [eventId], limit: 2000 }) as Promise<NostrEvent[]>,
          pool.querySync(FALLBACK_RELAYS, { kinds: [1], '#e': [eventId], limit: 2000 }) as Promise<NostrEvent[]>,
          pool.querySync(FALLBACK_RELAYS, { kinds: [6], '#e': [eventId], limit: 2000 }) as Promise<NostrEvent[]>,
          pool.querySync(FALLBACK_RELAYS, { kinds: [9735], '#e': [eventId], limit: 2000 }) as Promise<NostrEvent[]>,
        ]);

        const target = noteEvents[0] ?? null;
        setEvent(target);

        if (target?.pubkey) {
          const profiles = await fetchProfilesBatchCached([target.pubkey]);
          setProfile(profiles.get(target.pubkey) ?? null);
        } else {
          setProfile(null);
        }

        const zapSats = zapEvents.reduce((sum, z) => sum + (parseZapReceipt(z)?.amountSat ?? 0), 0);
        setMetrics({
          reactions: reactionEvents.length,
          reposts: repostEvents.length,
          replies: replyEvents.length,
          zaps: zapEvents.length,
          zapSats,
        });
      } catch (error) {
        console.error('Failed to load post modal data', error);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [eventId, isOpen, initialMetrics]);

  if (!isOpen || !eventId) return null;

  const npub = event?.pubkey ? encodeNpub(event.pubkey) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-3 sm:p-6 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-xl border border-cyan-500/30 bg-[#070b16] shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#070b16]/95 backdrop-blur-sm border-b border-cyan-500/20 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Post Details</h2>
          <button type="button" onClick={onClose} className="text-gray-300 hover:text-white text-xl leading-none" aria-label="Close">
            ×
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-gray-300">Loading post…</div>
        ) : !event ? (
          <div className="p-6 text-red-300">Could not load post details.</div>
        ) : (
          <div className="p-4 sm:p-6 space-y-5">
            <div className="flex items-start gap-3">
              <Avatar pubkey={event.pubkey} size={44} clickable={false} />
              <div className="min-w-0">
                <p className="text-white font-semibold truncate">{profileDisplayName(event.pubkey, profile)}</p>
                <div className="text-xs text-gray-400 space-x-2">
                  <span>{profile?.nip05 || truncateNpub(npub || event.pubkey, 8)}</span>
                  <span>•</span>
                  <span>{new Date(event.created_at * 1000).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <article className="text-gray-100 whitespace-pre-wrap break-words leading-relaxed">{event.content || '(No content)'}</article>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              <div className="rounded bg-gray-800/60 px-3 py-2">❤️ {metrics.reactions}</div>
              <div className="rounded bg-gray-800/60 px-3 py-2">🔁 {metrics.reposts}</div>
              <div className="rounded bg-gray-800/60 px-3 py-2">💬 {metrics.replies}</div>
              <div className="rounded bg-gray-800/60 px-3 py-2">⚡ {metrics.zaps}</div>
              <div className="rounded bg-gray-800/60 px-3 py-2">{metrics.zapSats.toLocaleString()} sats</div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Link to="/feed" className="px-3 py-2 rounded-md bg-cyan-700 hover:bg-cyan-600 text-white text-sm">
                Open in Feed
              </Link>
              {npub && (
                <Link to={`/profile/${npub}`} className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white text-sm">
                  View Author Profile
                </Link>
              )}
              <a
                href={`https://njump.me/${eventId}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white text-sm"
              >
                Open in njump
              </a>
              <a href={`/feed?replyTo=${eventId}`} className="px-3 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-white text-sm">Reply</a>
              <a href={`/feed?repost=${eventId}`} className="px-3 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-white text-sm">Repost</a>
              <a href={`/feed?zap=${eventId}`} className="px-3 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-white text-sm">Zap</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
