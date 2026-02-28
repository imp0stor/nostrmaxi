import { useMemo, useState } from 'react';
import type { ExternalIdentity } from '../../hooks/useOnboarding';

const PLATFORM_OPTIONS = [
  'twitter',
  'github',
  'telegram',
  'mastodon',
  'youtube',
  'linkedin',
  'website',
  'other',
];

interface Props {
  pubkey?: string;
  identities: ExternalIdentity[];
  onAdd: (identity: ExternalIdentity) => void;
  onRemove: (platform: string, identity: string) => void;
  onSkip: () => void;
}

export function ExternalAccountLink({ pubkey, identities, onAdd, onRemove, onSkip }: Props) {
  const [platform, setPlatform] = useState('twitter');
  const [identity, setIdentity] = useState('');
  const [proof, setProof] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const verificationText = useMemo(
    () => `Verifying my Nostr: ${pubkey || 'npub1...'} on ${platform}`,
    [pubkey, platform],
  );

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-slate-950/50 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-cyan-100">Link External Accounts (NIP-39)</p>
        <button type="button" className="text-xs text-cyan-300 underline" onClick={onSkip}>Set up later</button>
      </div>

      <div className="space-y-2">
        {identities.map((item) => (
          <div key={`${item.platform}:${item.identity}`} className="rounded border border-cyan-500/20 px-2 py-1 text-xs flex items-center justify-between">
            <span>
              {item.verified ? '✓' : '•'} {item.platform}:{item.identity}
            </span>
            <button type="button" className="text-red-300" onClick={() => onRemove(item.platform, item.identity)}>Remove</button>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-3 gap-2">
        <select className="cy-input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {PLATFORM_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <input
          className="cy-input"
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          placeholder="username"
        />
        <button type="button" className="cy-btn-secondary" onClick={() => setIsOpen(true)}>+ Link account</button>
      </div>

      {isOpen ? (
        <div className="rounded border border-fuchsia-400/40 bg-fuchsia-500/10 p-3 space-y-2 text-sm">
          <p className="text-fuchsia-100">Post this verification on {platform}:</p>
          <pre className="bg-slate-950/70 p-2 rounded text-xs whitespace-pre-wrap">{verificationText}</pre>
          <div className="flex gap-2">
            <button type="button" className="cy-btn-secondary text-xs" onClick={() => navigator.clipboard.writeText(verificationText)}>Copy to clipboard</button>
            <button type="button" className="cy-btn-secondary text-xs" onClick={() => setIsOpen(false)}>Cancel</button>
          </div>
          <input
            className="cy-input"
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            placeholder="Paste proof post URL"
          />
          <button
            type="button"
            className="cy-btn text-xs"
            disabled={!identity.trim() || !proof.trim()}
            onClick={() => {
              onAdd({ platform, identity: identity.trim(), proof: proof.trim(), verified: true });
              setIdentity('');
              setProof('');
              setIsOpen(false);
            }}
          >
            Verify and add
          </button>
        </div>
      ) : null}
    </div>
  );
}
