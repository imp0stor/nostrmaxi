import { useEffect, useState } from 'react';
import type { NostrEvent, NostrProfile } from '../types';
import { quotedIdentity } from '../lib/quotes';
import { quotedRenderModel } from '../lib/quotedMedia';
import { fetchProfileCached, isValidNip05 } from '../lib/profileCache';
import { Avatar } from './Avatar';
import { RichMedia } from './RichMedia';
import { MarkdownContent } from './MarkdownContent';

interface Props {
  event?: NostrEvent;
  profile?: NostrProfile | null;
  loading?: boolean;
  unavailable?: boolean;
  compact?: boolean;
  onRetry?: () => void;
}

export function QuotedEventCard({
  event,
  profile,
  loading = false,
  unavailable = false,
  compact = false,
  onRetry,
}: Props) {
  const spacing = compact ? '' : 'mt-3';
  const [resolvedProfile, setResolvedProfile] = useState<NostrProfile | null>(profile ?? null);

  useEffect(() => {
    if (!event) return;

    let cancelled = false;

    if (profile) {
      setResolvedProfile(profile);
      return;
    }

    fetchProfileCached(event.pubkey)
      .then((fetched) => {
        if (!cancelled) setResolvedProfile(fetched);
      })
      .catch(() => {
        if (!cancelled) setResolvedProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [event, profile]);

  if (loading && !event) {
    return (
      <div className={`${spacing} rounded-lg border border-indigo-500/30 bg-slate-900/70 p-3`}>
        <p className="text-xs text-slate-300">Loading quoted event...</p>
      </div>
    );
  }

  if (!event && unavailable) {
    return (
      <div className={`${spacing} rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-400`}>
        <p>Quoted event could not be loaded.</p>
        {onRetry ? (
          <button onClick={onRetry} className="cy-chip text-xs mt-2" type="button">
            🔄 Retry
          </button>
        ) : null}
      </div>
    );
  }

  if (!event) {
    return (
      <div className={`${spacing} rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-400`}>
        Event unavailable
      </div>
    );
  }

  const model = quotedRenderModel(event);
  const fallbackText = event.content.length > 260 ? `${event.content.slice(0, 260)}…` : event.content;
  const identity = quotedIdentity(event.pubkey, resolvedProfile);
  const subIdentity = isValidNip05(resolvedProfile?.nip05)
    ? resolvedProfile?.display_name || resolvedProfile?.name
    : resolvedProfile?.nip05;

  return (
    <div className={`${spacing} rounded-lg border border-indigo-400/30 bg-slate-900/80 p-3`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar pubkey={event.pubkey} size={24} clickable={false} className="shrink-0" />
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-indigo-200">{identity}</div>
            {subIdentity ? <div className="truncate text-[11px] text-slate-400">{subIdentity}</div> : null}
          </div>
        </div>
        <span className="shrink-0 text-xs text-slate-400">{new Date(event.created_at * 1000).toLocaleString()}</span>
      </div>

      <MarkdownContent text={model.text || fallbackText} className="mt-2 text-sm text-slate-200" />

      {(model.images.length > 0 || model.videos.length > 0 || model.audios.length > 0 || model.links.length > 0) ? (
        <div className="mt-2">
          <RichMedia images={model.images} videos={model.videos as any} audios={model.audios} links={model.links} compact={compact} />
        </div>
      ) : null}
    </div>
  );
}
