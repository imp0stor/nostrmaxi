import { useState } from 'react';
import type { RelaySuggestion } from '../../hooks/useOnboarding';

interface Props {
  relays: { selected: string[]; suggestions: RelaySuggestion[] };
  onToggleRelay: (url: string) => void;
  onAddManualRelay: (url: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function OnboardingRelays({ relays, onToggleRelay, onAddManualRelay, onNext, onBack }: Props) {
  const [manualRelay, setManualRelay] = useState('');

  return (
    <section className="cy-card p-6 space-y-4">
      <h2 className="text-xl text-cyan-100 font-semibold">Choose your relays</h2>
      <p className="text-sm text-gray-300">Smart suggestions combine uptime, WoT, region, and relay type.</p>

      <div className="grid gap-3 max-h-[50vh] overflow-y-auto pr-1">
        {relays.suggestions.map((relay) => {
          const selected = relays.selected.includes(relay.url);
          return (
            <button
              key={relay.url}
              className={`text-left rounded-lg border p-3 ${selected ? 'border-cyan-400 bg-cyan-500/10' : 'border-cyan-500/30 bg-slate-950/60'}`}
              onClick={() => onToggleRelay(relay.url)}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-cyan-100 font-medium">{relay.name}</p>
                <span className="text-xs text-cyan-300">{relay.type.toUpperCase()}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{relay.url}</p>
              <p className="text-xs text-gray-300 mt-2">{relay.description}</p>
              <p className="text-xs text-cyan-200 mt-2">Uptime {relay.uptime}% • WoT {relay.wotScore} • {relay.region}</p>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          className="cy-input"
          value={manualRelay}
          onChange={(e) => setManualRelay(e.target.value)}
          placeholder="wss://your-relay.example"
        />
        <button
          className="cy-btn-secondary"
          onClick={() => {
            onAddManualRelay(manualRelay);
            setManualRelay('');
          }}
        >
          Add relay
        </button>
      </div>

      <div className="flex justify-between">
        <button className="cy-btn-secondary" onClick={onBack}>Back</button>
        <button className="cy-btn" onClick={onNext}>Continue ({relays.selected.length})</button>
      </div>
    </section>
  );
}
