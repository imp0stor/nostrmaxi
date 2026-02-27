import { useMemo, useState } from 'react';
import type { ExternalIdentityProof } from '../../hooks/useExternalIdentities';

const PLATFORM_ICON: Record<string, string> = {
  github: '🐙',
  x: '✖️',
  mastodon: '🐘',
  telegram: '✈️',
  discord: '💬',
  website: '🌐',
  other: '🔗',
};

interface ExternalIdentityPanelProps {
  identities: ExternalIdentityProof[];
  isVerifying: boolean;
  canEdit?: boolean;
  onVerifyAll: () => void;
  onUpsert: (identity: Pick<ExternalIdentityProof, 'platform' | 'identity' | 'proof' | 'claim'>) => void;
  proofGuidance: (item: ExternalIdentityProof) => string;
}

function statusClasses(status: ExternalIdentityProof['verificationStatus']) {
  if (status === 'verified') return 'bg-green-500/20 text-green-200 border-green-400/40';
  if (status === 'failed') return 'bg-red-500/20 text-red-200 border-red-400/40';
  if (status === 'stale') return 'bg-yellow-500/20 text-yellow-100 border-yellow-400/40';
  return 'bg-slate-700/60 text-slate-200 border-slate-400/40';
}

export function ExternalIdentityPanel({
  identities,
  isVerifying,
  canEdit,
  onVerifyAll,
  onUpsert,
  proofGuidance,
}: ExternalIdentityPanelProps) {
  const [draft, setDraft] = useState({ platform: 'github', identity: '', proof: '', claim: '' });

  const verifiedCount = useMemo(
    () => identities.filter((identity) => identity.verificationStatus === 'verified').length,
    [identities],
  );

  return (
    <section className="cy-card p-5 space-y-4" data-testid="external-identity-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-cyan-200 font-semibold">External identities (NIP-39)</h2>
          <p className="text-xs text-slate-400 mt-1">{verifiedCount}/{identities.length} verified identities</p>
        </div>
        <button type="button" className="cy-btn-secondary" onClick={onVerifyAll} disabled={isVerifying}>
          {isVerifying ? 'Verifying…' : 'Verify identities'}
        </button>
      </div>

      {identities.length === 0 ? <p className="cy-muted">No external identities claimed on this profile yet.</p> : null}

      <div className="grid gap-3 md:grid-cols-2">
        {identities.map((item) => (
          <article key={`${item.platform}-${item.identity}`} className="rounded-lg border border-cyan-500/20 bg-slate-900/70 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-cyan-100 truncate">{PLATFORM_ICON[item.platform] || PLATFORM_ICON.other} {item.identity}</p>
              <span className={`text-[11px] uppercase border rounded-full px-2 py-0.5 ${statusClasses(item.verificationStatus)}`}>
                {item.verificationStatus}
              </span>
            </div>

            {item.platform === 'github' && item.github ? (
              <div className="text-xs text-slate-300 grid grid-cols-3 gap-2">
                <p><span className="text-slate-500 block">Repos</span>{item.github.publicRepos}</p>
                <p><span className="text-slate-500 block">Followers</span>{item.github.followers}</p>
                <p><span className="text-slate-500 block">Languages</span>{item.github.languages.slice(0, 2).join(', ') || '—'}</p>
              </div>
            ) : null}

            {item.platform === 'x' ? (
              <div className="text-xs text-slate-300">
                <p>X/Twitter verification {item.twitter?.proofUrl ? `via ${item.twitter.proofUrl}` : 'pending proof URL'}</p>
              </div>
            ) : null}

            {item.linkUrl ? (
              <a href={item.linkUrl} target="_blank" rel="noreferrer" className="text-xs text-cyan-300 hover:text-cyan-200 underline break-all">{item.linkUrl}</a>
            ) : null}

            {item.error ? <p className="text-xs text-red-300">{item.error}</p> : null}
            <p className="text-[11px] text-slate-500">{proofGuidance(item)}</p>
          </article>
        ))}
      </div>

      {canEdit ? (
        <div className="rounded-lg border border-cyan-500/25 bg-slate-950/70 p-3 space-y-2">
          <h3 className="text-sm font-semibold text-cyan-100">Add or edit identity claim</h3>
          <div className="grid md:grid-cols-4 gap-2">
            <select
              value={draft.platform}
              onChange={(e) => setDraft((prev) => ({ ...prev, platform: e.target.value }))}
              className="bg-slate-950 border border-cyan-500/25 rounded px-2 py-1 text-sm"
            >
              <option value="github">GitHub</option>
              <option value="x">X/Twitter</option>
              <option value="telegram">Telegram</option>
              <option value="website">Website</option>
              <option value="other">Other</option>
            </select>
            <input className="bg-slate-950 border border-cyan-500/25 rounded px-2 py-1 text-sm md:col-span-1" placeholder="identity (e.g. github:neo)" value={draft.identity} onChange={(e) => setDraft((prev) => ({ ...prev, identity: e.target.value }))} />
            <input className="bg-slate-950 border border-cyan-500/25 rounded px-2 py-1 text-sm md:col-span-1" placeholder="proof URL" value={draft.proof} onChange={(e) => setDraft((prev) => ({ ...prev, proof: e.target.value }))} />
            <input className="bg-slate-950 border border-cyan-500/25 rounded px-2 py-1 text-sm md:col-span-1" placeholder="claim note" value={draft.claim} onChange={(e) => setDraft((prev) => ({ ...prev, claim: e.target.value }))} />
          </div>
          <button
            type="button"
            className="cy-btn-secondary"
            onClick={() => {
              if (!draft.identity.trim()) return;
              onUpsert({
                platform: draft.platform,
                identity: draft.identity.trim(),
                proof: draft.proof.trim() || undefined,
                claim: draft.claim.trim() || undefined,
              });
              setDraft((prev) => ({ ...prev, identity: '', proof: '', claim: '' }));
            }}
          >
            Save claim
          </button>
        </div>
      ) : null}
    </section>
  );
}
