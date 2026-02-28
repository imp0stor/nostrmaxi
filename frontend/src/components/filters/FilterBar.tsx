import { useMemo, useState } from 'react';
import { TagFilterWidget } from './TagFilterWidget';

interface FilterBarProps {
  availableTags: string[];
  selectedTags: string[];
  logic: 'and' | 'or';
  title?: string;
  onTagsChange: (tags: string[]) => void;
  onLogicChange: (logic: 'and' | 'or') => void;
  onApply: () => void;
}

export function FilterBar({ availableTags, selectedTags, logic, title = 'Filters', onTagsChange, onLogicChange, onApply }: FilterBarProps) {
  const [open, setOpen] = useState(false);

  const summary = useMemo(() => {
    if (selectedTags.length === 0) return 'No tags selected';
    return `${selectedTags.length} tag${selectedTags.length === 1 ? '' : 's'} · ${logic.toUpperCase()}`;
  }, [selectedTags, logic]);

  return (
    <section className="cy-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="cy-kicker">{title}</p>
          <p className="text-xs text-cyan-300">{summary}</p>
        </div>
        <button type="button" className="cy-btn-secondary text-xs" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open ? (
        <TagFilterWidget
          availableTags={availableTags}
          selectedTags={selectedTags}
          logic={logic}
          onTagsChange={onTagsChange}
          onLogicChange={onLogicChange}
          onApply={onApply}
        />
      ) : null}
    </section>
  );
}
