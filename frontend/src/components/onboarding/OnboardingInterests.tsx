import { useState } from 'react';

const DEFAULT_INTERESTS = [
  'bitcoin',
  'lightning',
  'nostr',
  'privacy',
  'open-source',
  'ai',
  'art',
  'music',
  'photography',
  'development',
  'security',
  'freedom',
  'gaming',
  'sports',
  'news',
  'science',
  'philosophy',
  'memes',
];

interface Props {
  selected: string[];
  custom: string[];
  onChange: (next: { interests: string[]; customInterests: string[] }) => void;
  onSkip: () => void;
}

export function OnboardingInterests({ selected, custom, onChange, onSkip }: Props) {
  const [customInput, setCustomInput] = useState('');

  const toggle = (topic: string) => {
    const has = selected.includes(topic);
    const next = has ? selected.filter((item) => item !== topic) : [...selected, topic];
    onChange({ interests: next, customInterests: custom });
  };

  const addCustom = () => {
    const cleaned = customInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (!cleaned) return;
    if (!custom.includes(cleaned)) {
      const nextCustom = [...custom, cleaned];
      const nextSelected = selected.includes(cleaned) ? selected : [...selected, cleaned];
      onChange({ interests: nextSelected, customInterests: nextCustom });
    }
    setCustomInput('');
  };

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-slate-950/50 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-cyan-100">🏷️ Your Interests</p>
        <button type="button" className="text-xs text-cyan-300 underline" onClick={onSkip}>Set up later</button>
      </div>
      <p className="text-xs text-gray-300">Select topics you're interested in:</p>

      <div className="flex flex-wrap gap-2">
        {DEFAULT_INTERESTS.map((topic) => {
          const active = selected.includes(topic);
          return (
            <button
              key={topic}
              type="button"
              className={`px-2 py-1 rounded text-xs border ${active ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-cyan-500/20 text-gray-300'}`}
              onClick={() => toggle(topic)}
            >
              {topic} {active ? '✓' : ''}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          className="cy-input"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="Add custom interest"
        />
        <button type="button" className="cy-btn-secondary" onClick={addCustom}>Add</button>
      </div>

      <p className="text-[11px] text-gray-400">These improve feed/follow suggestions and AI bio quality.</p>
    </div>
  );
}
