import { useState } from 'react';
import type { OnboardingState } from '../../hooks/useOnboarding';

interface Props {
  state: OnboardingState;
  onGenerate: () => void;
  onImport: (key: string) => boolean;
  onIdentityChange: (partial: Partial<OnboardingState['identity']>) => void;
  onNext: () => void;
}

export function OnboardingWelcome({ state, onGenerate, onImport, onIdentityChange, onNext }: Props) {
  const [importKey, setImportKey] = useState('');

  return (
    <section className="cy-card p-6 space-y-4">
      <h2 className="text-xl text-cyan-100 font-semibold">Create or import your Nostr account</h2>
      <div className="grid md:grid-cols-2 gap-3">
        <button className="cy-btn" onClick={onGenerate}>Generate new keypair</button>
        <div className="space-y-2">
          <input
            className="cy-input"
            value={importKey}
            onChange={(e) => setImportKey(e.target.value)}
            placeholder="Paste 64-char private key"
          />
          <button className="cy-btn-secondary w-full" onClick={() => onImport(importKey)}>Import existing key</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-cyan-100">NIP-05 Name</label>
          <input
            className="cy-input mt-1"
            value={state.identity.name || ''}
            onChange={(e) => onIdentityChange({ name: e.target.value, nip05: `${e.target.value || 'name'}@nostrmaxi.com` })}
            placeholder="satoshi"
          />
          <p className="text-xs text-gray-400 mt-1">Reserved names pricing: 1-2 chars premium, 3-5 chars standard, 6+ chars starter.</p>
        </div>
        <div>
          <label className="text-sm text-cyan-100">Lightning Address (optional)</label>
          <input
            className="cy-input mt-1"
            value={state.identity.lightningAddress || ''}
            onChange={(e) => onIdentityChange({ lightningAddress: e.target.value })}
            placeholder="you@getalby.com"
          />
        </div>
      </div>

      {state.identity.pubkey ? (
        <div className="text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded p-3 break-all">
          Pubkey: {state.identity.pubkey}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button className="cy-btn" onClick={onNext} disabled={!state.identity.pubkey}>Continue</button>
      </div>
    </section>
  );
}
