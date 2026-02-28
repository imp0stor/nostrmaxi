import { useEffect, useRef, useState } from 'react';
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

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function PostModal({ eventId, isOpen, onClose, initialMetrics }: PostModalProps) {
  const [event, setEvent] = useState<NostrEvent | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [metrics, setMetrics] = useState<EngagementMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announceText, setAnnounceText] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const loadData = async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
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
    } catch (loadError) {
      console.error('Failed to load post modal data', loadError);
      setError('We could not load this post right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setIsVisible(false);
      return;
    }

    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setAnnounceText('Post details dialog opened');

    const frame = window.requestAnimationFrame(() => {
      setIsVisible(true);
      closeButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
      setAnnounceText('Post details dialog closed');
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !eventId) return;
    void loadData();
  }, [eventId, isOpen, initialMetrics]);

  if (!isOpen || !eventId) return null;

  const npub = event?.pubkey ? encodeNpub(event.pubkey) : null;

  return (
    <>
      <div className="sr-only" aria-live="polite">{announceText}</div>
      <div
        className={`fixed inset-0 z-50 p-0 sm:p-6 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        role="presentation"
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-modal-title"
          className={`w-full sm:w-auto sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-cyan-500/30 bg-[#070b16] shadow-2xl transition-all duration-200 ease-out transform ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-[#070b16]/95 backdrop-blur-sm border-b border-cyan-500/20 px-4 py-3 flex items-center justify-between">
            <h2 id="post-modal-title" className="text-lg font-semibold text-white">Post Details</h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="text-gray-300 hover:text-white text-xl leading-none rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              aria-label="Close post details"
            >
              ×
            </button>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-gray-300 text-sm">
                <span className="inline-block h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                Loading...
              </div>
              <div className="h-4 bg-gray-800/70 rounded animate-pulse" />
              <div className="h-4 w-10/12 bg-gray-800/70 rounded animate-pulse" />
              <div className="h-20 bg-gray-800/70 rounded animate-pulse" />
            </div>
          ) : error ? (
            <div className="p-6 space-y-3">
              <p className="text-red-300">{error}</p>
              <button
                type="button"
                onClick={() => void loadData()}
                className="px-3 py-2 rounded-md bg-red-700/80 hover:bg-red-700 text-white text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                Retry
              </button>
            </div>
          ) : !event ? (
            <div className="p-6 text-gray-300">📭 No post found for this event.</div>
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
                <div className="rounded bg-gray-800/60 px-3 py-2 border border-gray-700/60">❤️ {metrics.reactions}</div>
                <div className="rounded bg-gray-800/60 px-3 py-2 border border-gray-700/60">🔁 {metrics.reposts}</div>
                <div className="rounded bg-gray-800/60 px-3 py-2 border border-gray-700/60">💬 {metrics.replies}</div>
                <div className="rounded bg-gray-800/60 px-3 py-2 border border-gray-700/60">⚡ {metrics.zaps}</div>
                <div className="rounded bg-gray-800/60 px-3 py-2 border border-gray-700/60">{metrics.zapSats.toLocaleString()} sats</div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Link to="/feed" className="px-3 py-2 rounded-md bg-cyan-700 hover:bg-cyan-600 active:bg-cyan-500 text-white text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                  Open in Feed
                </Link>
                {npub && (
                  <Link to={`/profile/${npub}`} className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                    View Author Profile
                  </Link>
                )}
                <a
                  href={`https://njump.me/${eventId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  Open in njump
                </a>
                <a href={`/feed?replyTo=${eventId}`} className="px-3 py-2 rounded-md bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">Reply</a>
                <a href={`/feed?repost=${eventId}`} className="px-3 py-2 rounded-md bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">Repost</a>
                <a href={`/feed?zap=${eventId}`} className="px-3 py-2 rounded-md bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">Zap</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
