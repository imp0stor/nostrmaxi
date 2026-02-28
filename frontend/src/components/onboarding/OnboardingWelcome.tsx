import { useState } from 'react';
import type { OnboardingState } from '../../hooks/useOnboarding';

interface Props {
  state: OnboardingState;
  onGenerate: () => void;
  onImport: (key: string) => boolean;
  onIdentityChange: (partial: Partial<OnboardingState['identity']>) => void;
  onPaid: () => void;
  onNext: () => void;
  onBack: () => void;
}

export function OnboardingWelcome({ state, onGenerate, onImport, onIdentityChange, onPaid, onNext, onBack }: Props) {
  const [importKey, setImportKey] = useState('');

  return (
    <section className="cy-card p-6 space-y-4">
      <h2 className="text-xl text-cyan-100 font-semibold">Premium identity setup</h2>
      <p className="text-sm text-gray-300">Choose your key, claim your NIP-05, and complete Lightning payment.</p>

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
          <p className="text-xs text-gray-400 mt-1">Pricing: base 21k sats • short names 100k+ sats • premium reserved names custom pricing.</p>
        </div>
        <div>
          <label className="text-sm text-cyan-100">Lightning Address</label>
          <input
            className="cy-input mt-1"
            value={state.identity.lightningAddress || ''}
            onChange={(e) => onIdentityChange({ lightningAddress: e.target.value })}
            placeholder="you@nostrmaxi.com"
          />
        </div>
      </div>

      <div className="rounded border border-yellow-400/30 bg-yellow-500/10 p-3">
        <p className="text-sm text-yellow-100">Lightning payment integration</p>
        <p className="text-xs text-gray-300 mt-1">Invoice amount: 21,000 sats (simulated in this flow).</p>
        <button className="cy-btn-secondary mt-2" onClick={onPaid}>Mark invoice as paid</button>
        {state.identity.paymentComplete ? <p className="text-xs text-emerald-300 mt-2">Payment confirmed ✓</p> : null}
      </div>

      <div className="flex justify-between">
        <button className="cy-btn-secondary" onClick={onBack}>Back</button>
        <button className="cy-btn" onClick={onNext} disabled={!state.identity.pubkey || !state.identity.paymentComplete || !state.identity.name}>Continue</button>
      </div>
    </section>
  );
}
