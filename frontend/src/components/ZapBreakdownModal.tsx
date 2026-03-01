/**
 * Zap Breakdown Modal
 * 
 * Shows detailed breakdown of all zaps received on a specific post.
 * Click any post → see all zappers, amounts, messages, timestamps.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ParsedZapReceipt } from '../lib/zaps';
import { loadZapReceipts } from '../lib/zaps';
import { truncateNpub, encodeNpub } from '../lib/nostr';
import { fetchProfilesBatchCached, profileDisplayName } from '../lib/profileCache';
import { Avatar } from './Avatar';

interface ZapBreakdownModalProps {
  eventId: string;
  onClose: () => void;
}

export function ZapBreakdownModal({ eventId, onClose }: ZapBreakdownModalProps) {
  const [zaps, setZaps] = useState<ParsedZapReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'amount' | 'time'>('amount');
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const receipts = await loadZapReceipts([eventId], []);
        setZaps(receipts);

        // Hydrate profiles for zappers
        const pubkeys = receipts
          .filter((z) => !z.anonymous)
          .map((z) => z.senderPubkey);
        const profileMap = await fetchProfilesBatchCached(pubkeys);
        setProfiles(profileMap);
      } catch (error) {
        console.error('Failed to load zap breakdown:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [eventId]);

  const sortedZaps = [...zaps].sort((a, b) => {
    if (sortBy === 'amount') {
      return b.amountSat - a.amountSat;
    }
    return b.id.localeCompare(a.id); // Timestamp sort by event ID (rough proxy)
  });

  const totalSats = zaps.reduce((sum, z) => sum + z.amountSat, 0);
  const uniqueZappers = new Set(zaps.map((z) => z.anonymous ? 'anon' : z.senderPubkey)).size;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Zap contributor details" className="bg-[#0a0f1e] border border-orange-500/40 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="border-b border-cyan-500/30 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-cyan-100">⚡ Zap Breakdown</h2>
            <p className="text-sm text-cyan-300/70">
              {totalSats.toLocaleString()} sats · {zaps.length} {zaps.length === 1 ? 'zap' : 'zaps'} · {uniqueZappers} {uniqueZappers === 1 ? 'zapper' : 'zappers'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-cyan-300 hover:text-cyan-100 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Sort controls */}
        <div className="p-4 border-b border-cyan-500/30 flex gap-2">
          <button
            type="button"
            onClick={() => setSortBy('amount')}
            className={`px-3 py-1.5 rounded-md text-sm ${
              sortBy === 'amount'
                ? 'bg-cyan-500/20 border border-cyan-300 text-cyan-100'
                : 'bg-slate-950/70 border border-cyan-500/30 text-cyan-200'
            }`}
          >
            Sort by Amount
          </button>
          <button
            type="button"
            onClick={() => setSortBy('time')}
            className={`px-3 py-1.5 rounded-md text-sm ${
              sortBy === 'time'
                ? 'bg-cyan-500/20 border border-cyan-300 text-cyan-100'
                : 'bg-slate-950/70 border border-cyan-500/30 text-cyan-200'
            }`}
          >
            Sort by Time
          </button>
        </div>

        {/* Zap list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-cyan-300">Loading zaps...</div>
          ) : zaps.length === 0 ? (
            <div className="text-center py-8 text-cyan-300/70">No zaps yet</div>
          ) : (
            sortedZaps.map((zap) => {
              const profile = profiles.get(zap.senderPubkey);
              const displayName = zap.anonymous
                ? 'Anonymous'
                : profileDisplayName(zap.senderPubkey, profile);
              const npub = zap.anonymous ? '' : encodeNpub(zap.senderPubkey);

              return (
                <div
                  key={zap.id}
                  className="bg-slate-950/50 border border-orange-500/20 rounded-lg p-3 hover:border-orange-300/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {!zap.anonymous ? (
                      <Link to={`/profile/${zap.senderPubkey}`} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/80" aria-label={`Open zapper profile ${displayName}`}>
                        <Avatar pubkey={zap.senderPubkey} size={40} />
                      </Link>
                    ) : null}
                    {zap.anonymous && (
                      <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-300 text-xl">
                        👤
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          {!zap.anonymous ? (
                            <Link to={`/profile/${zap.senderPubkey}`} className="font-semibold text-orange-100 hover:text-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/80 rounded-sm">{displayName}</Link>
                          ) : <p className="font-semibold text-cyan-100">{displayName}</p>}
                          {!zap.anonymous && (
                            <p className="text-xs text-cyan-300/70">{truncateNpub(npub)}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-cyan-100">
                            ⚡ {zap.amountSat.toLocaleString()}
                          </p>
                          <p className="text-xs text-cyan-300/70">sats</p>
                        </div>
                      </div>
                      
                      {zap.content && (
                        <p className="mt-2 text-sm text-neutral-300/90 break-words">
                          "{zap.content}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-cyan-500/30 p-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-100 rounded-lg hover:bg-cyan-500/20"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
