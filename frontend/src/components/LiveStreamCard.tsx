import { PlatformIframeEmbed } from './PlatformIframeEmbed';
import type { LiveStreamMeta } from '../lib/contentTypes';

function isHls(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url);
}

export function LiveStreamCard({ meta }: { meta: LiveStreamMeta }) {
  const statusTone = meta.status === 'live'
    ? 'border-red-400/70 text-red-200 bg-red-500/15'
    : meta.status === 'ended'
      ? 'border-slate-500 text-slate-300 bg-slate-600/15'
      : 'border-amber-400/60 text-amber-200 bg-amber-500/15';

  return (
    <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/10 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${statusTone}`}>
            {meta.status.toUpperCase()}
          </p>
          <h3 className="text-red-100 font-semibold mt-2">{meta.title}</h3>
          <p className="text-xs text-red-200/80">Streamer: {meta.host}</p>
          {typeof meta.viewerCount === 'number' ? <p className="text-xs text-red-300 mt-1">👀 {meta.viewerCount.toLocaleString()} watching now</p> : null}
          {meta.summary ? <p className="text-sm text-slate-200 mt-2 whitespace-pre-wrap">{meta.summary}</p> : null}
        </div>
        {meta.thumbnail ? <img src={meta.thumbnail} alt="Live stream thumbnail" className="w-28 h-20 object-cover rounded border border-red-500/30" /> : null}
      </div>

      {meta.streamUrl ? (
        isHls(meta.streamUrl) || /\.(mp4|webm|mov)(\?|$)/i.test(meta.streamUrl) ? (
          <video controls className="w-full rounded border border-red-500/30 bg-black" preload="metadata">
            <source src={meta.streamUrl} />
          </video>
        ) : (
          <PlatformIframeEmbed title="Live stream" embedUrl={meta.streamUrl} sourceUrl={meta.streamUrl} aspect="video" />
        )
      ) : null}

      <div className="flex flex-wrap gap-2 text-xs">
        {meta.streamUrl ? <a href={meta.streamUrl} target="_blank" rel="noreferrer" className="cy-chip">Open stream</a> : null}
        {meta.recordingUrl ? <a href={meta.recordingUrl} target="_blank" rel="noreferrer" className="cy-chip">Recording</a> : null}
        {meta.chatUrl ? <a href={meta.chatUrl} target="_blank" rel="noreferrer" className="cy-chip">Live chat</a> : null}
      </div>
    </div>
  );
}
