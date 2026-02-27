import { getDomain } from '../lib/media';
import type { LinkPreview } from '../lib/richEmbeds';

export function LinkPreviewCard({ url, preview }: { url: string; preview?: LinkPreview }) {
  return (
    <a key={url} href={url} target="_blank" rel="noreferrer" className="block rounded-md border border-cyan-900/80 bg-[#080d22] hover:border-cyan-300/90 transition-colors">
      {preview?.image ? <img src={preview.image} loading="lazy" alt="Link preview" className="w-full h-40 object-cover" /> : null}
      <div className="p-3 space-y-1">
        <p className="text-[11px] uppercase tracking-wider text-cyan-400">{preview?.siteName || preview?.domain || getDomain(url)}</p>
        <p className="text-sm font-semibold text-cyan-100 line-clamp-2">{preview?.title || url}</p>
        {preview?.description ? <p className="text-sm text-blue-100/80 line-clamp-2">{preview.description}</p> : <p className="text-xs text-cyan-300/80 break-all">{url}</p>}
      </div>
    </a>
  );
}
