import { useEffect, useState } from 'react';
import type { LinkPreview } from '../lib/richEmbeds';
import { toFxTwitterUrl } from '../lib/richEmbeds';

export function TwitterEmbed({ url }: { url: string }) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const fxUrl = toFxTwitterUrl(url);

  useEffect(() => {
    if (!fxUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/v1/unfurl?url=${encodeURIComponent(fxUrl)}`);
        if (!response.ok) return;
        const json = (await response.json()) as LinkPreview;
        if (!cancelled) setPreview(json);
      } catch {
        // fallback
      }
    })();
    return () => { cancelled = true; };
  }, [fxUrl]);

  return (
    <a href={url} target="_blank" rel="noreferrer" className="block w-full max-w-3xl overflow-hidden rounded-lg border border-sky-800/70 bg-[#091322] hover:border-sky-400/80 transition-colors">
      {preview?.image ? <img src={preview.image} alt="Tweet preview" className="w-full max-h-[340px] object-cover" loading="lazy" /> : <div className="h-28 animate-pulse bg-sky-900/20" aria-hidden="true" />}
      <div className="max-h-[210px] overflow-hidden p-3 space-y-1">
        <p className="text-[11px] uppercase tracking-wider text-sky-400">Twitter / X</p>
        <p className="text-sm font-semibold text-sky-100 line-clamp-2">{preview?.title || 'Open post on X'}</p>
        {preview?.description ? <p className="text-sm text-sky-100/80 line-clamp-4">{preview.description}</p> : <p className="text-xs text-sky-200/75 break-all line-clamp-2">{url}</p>}
      </div>
    </a>
  );
}
