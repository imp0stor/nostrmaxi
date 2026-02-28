import { useMemo, useState } from 'react';

interface TagFilterWidgetProps {
  availableTags: string[];
  selectedTags: string[];
  logic: 'and' | 'or';
  onTagsChange: (tags: string[]) => void;
  onLogicChange: (logic: 'and' | 'or') => void;
  onApply: () => void;
}

const normalize = (tag: string): string => tag.trim().toLowerCase();

const labelize = (tag: string): string => tag.charAt(0).toUpperCase() + tag.slice(1);

export function TagFilterWidget({ availableTags, selectedTags, logic, onTagsChange, onLogicChange, onApply }: TagFilterWidgetProps) {
  const [customTag, setCustomTag] = useState('');

  const normalizedSelected = useMemo(() => selectedTags.map(normalize), [selectedTags]);
  const selectedSet = useMemo(() => new Set(normalizedSelected), [normalizedSelected]);

  const normalizedAvailable = useMemo(
    () => Array.from(new Set(availableTags.map(normalize).filter(Boolean))).sort(),
    [availableTags],
  );

  const addTag = (tag: string) => {
    const next = normalize(tag);
    if (!next || selectedSet.has(next)) return;
    onTagsChange([...normalizedSelected, next]);
  };

  const removeTag = (tag: string) => {
    const next = normalize(tag);
    onTagsChange(normalizedSelected.filter((value) => value !== next));
  };

  const onAddCustom = () => {
    const next = normalize(customTag);
    if (!next) return;
    addTag(next);
    setCustomTag('');
  };

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-slate-950/70 p-4 space-y-4">
      <div>
        <p className="text-sm text-cyan-100 font-semibold">🏷️ Filter by Tags</p>
      </div>

      <div className="text-sm text-slate-200 flex flex-wrap items-center gap-4">
        <span>Match:</span>
        <label className="inline-flex items-center gap-2">
          <input type="radio" checked={logic === 'and'} onChange={() => onLogicChange('and')} />
          <span>All tags (AND)</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="radio" checked={logic === 'or'} onChange={() => onLogicChange('or')} />
          <span>Any tag (OR)</span>
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-cyan-300">Selected:</p>
        <div className="flex flex-wrap gap-2">
          {normalizedSelected.length === 0 ? <span className="text-xs text-slate-400">No tags selected</span> : normalizedSelected.map((tag) => (
            <button key={`selected-${tag}`} type="button" className="cy-chip text-xs" onClick={() => removeTag(tag)}>
              {labelize(tag)} ✓
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-cyan-300">Available:</p>
        <div className="flex flex-wrap gap-2">
          {normalizedAvailable.filter((tag) => !selectedSet.has(tag)).map((tag) => (
            <button key={`available-${tag}`} type="button" className="cy-chip text-xs" onClick={() => addTag(tag)}>
              {labelize(tag)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-cyan-300">+ Custom:</span>
        <input
          className="cy-input max-w-52"
          value={customTag}
          placeholder="custom tag"
          onChange={(e) => setCustomTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAddCustom();
            }
          }}
        />
        <button type="button" className="cy-btn-secondary text-xs" onClick={onAddCustom}>Add</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="cy-btn-secondary text-xs" onClick={() => onTagsChange([])}>Clear All</button>
        <button type="button" className="cy-btn text-xs" onClick={onApply}>Apply Filters</button>
      </div>
    </div>
  );
}

export type { TagFilterWidgetProps };
