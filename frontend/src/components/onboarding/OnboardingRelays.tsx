import { useState } from 'react';
import type { RelaySuggestion } from '../../hooks/useOnboarding';

interface Props {
  relays: {
    selected: string[];
    recommended: RelaySuggestion[];
    forWriting: RelaySuggestion[];
    forReading: RelaySuggestion[];
    popular: RelaySuggestion[];
  };
  onToggleRelay: (url: string) => void;
  onAddManualRelay: (url: string) => void;
  onNext: () => void;
  onBack: () => void;
}

interface RelayCardProps {
  relay: RelaySuggestion;
  badge: string;
  selected: boolean;
  onToggle: () => void;
}

function RelayCard({ relay, badge, selected, onToggle }: RelayCardProps) {
  return (
    <button
      type="button"
      className={`text-left rounded-xl border p-3 transition-all duration-200 ${selected ? 'border-cyan-300 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,.25)]' : 'border-slate-700 bg-slate-950/70 hover:border-cyan-500/45 hover:bg-slate-900/80'}`}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-cyan-100 font-medium break-all">{relay.url}</p>
          {relay.reason ? <p className="text-xs text-slate-300 mt-1">{relay.reason}</p> : null}
        </div>
        <span className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-1 border ${selected ? 'text-cyan-100 border-cyan-300/70 bg-cyan-500/20' : 'text-slate-300 border-slate-600 bg-slate-800/80'}`}>
          {badge}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
        {relay.score !== undefined ? <span>Score {relay.score.toFixed(2)}</span> : null}
        {relay.wotScore !== undefined ? <span>WoT {relay.wotScore.toFixed(2)}</span> : null}
        {relay.uptime !== undefined ? <span>Uptime {relay.uptime}%</span> : null}
        {relay.region ? <span>{relay.region}</span> : null}
      </div>
    </button>
  );
}

export function OnboardingRelays({ relays, onToggleRelay, onAddManualRelay, onNext, onBack }: Props) {
  const [manualRelay, setManualRelay] = useState('');

  const isNewUser = relays.recommended.length === 0 && relays.forWriting.length === 0 && relays.forReading.length === 0;

  return (
    <section className="cy-card p-6 space-y-4">
      <h2 className="text-xl text-cyan-100 font-semibold">Choose your relays</h2>
      <p className="text-sm text-gray-300">
        Relays are the servers that carry your posts and follows across Nostr.
        {isNewUser ? ' We picked reliable defaults to get you started.' : ' These are tailored from your network and publishing patterns.'}
      </p>

      <div className="space-y-4 max-h-[52vh] overflow-y-auto pr-1">
        {relays.recommended.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-cyan-100">Recommended for Your Network</h3>
            <p className="text-xs text-slate-400">Relays used by people you follow.</p>
            <div className="grid gap-2">
              {relays.recommended.map((relay) => (
                <RelayCard
                  key={`recommended-${relay.url}`}
                  relay={relay}
                  badge={relay.usedByFollows && relay.usedByFollows > 0 ? `${relay.usedByFollows} follows use this` : 'WoT recommended'}
                  selected={relays.selected.includes(relay.url)}
                  onToggle={() => onToggleRelay(relay.url)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {relays.forWriting.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-cyan-100">Best for Publishing</h3>
            <p className="text-xs text-slate-400">Your followers are most likely to see your posts here.</p>
            <div className="grid gap-2">
              {relays.forWriting.map((relay) => (
                <RelayCard
                  key={`writing-${relay.url}`}
                  relay={relay}
                  badge={relay.usedByFollows && relay.usedByFollows > 0 ? `${relay.usedByFollows} follows use this` : 'Best write relay'}
                  selected={relays.selected.includes(relay.url)}
                  onToggle={() => onToggleRelay(relay.url)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {relays.forReading.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-cyan-100">Best for Reading</h3>
            <p className="text-xs text-slate-400">Fast relays for pulling timeline updates and replies.</p>
            <div className="grid gap-2">
              {relays.forReading.map((relay) => (
                <RelayCard
                  key={`reading-${relay.url}`}
                  relay={relay}
                  badge={relay.usedByFollows && relay.usedByFollows > 0 ? `${relay.usedByFollows} follows use this` : 'Best read relay'}
                  selected={relays.selected.includes(relay.url)}
                  onToggle={() => onToggleRelay(relay.url)}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-cyan-100">Popular Relays</h3>
          <p className="text-xs text-slate-400">Reliable and well-connected defaults like Damus, Primal, and nos.lol.</p>
          <div className="grid gap-2">
            {relays.popular.map((relay) => (
              <RelayCard
                key={`popular-${relay.url}`}
                relay={relay}
                badge={relay.usedByFollows && relay.usedByFollows > 0 ? `${relay.usedByFollows} follows use this` : 'Popular relay'}
                selected={relays.selected.includes(relay.url)}
                onToggle={() => onToggleRelay(relay.url)}
              />
            ))}
          </div>
        </section>
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
