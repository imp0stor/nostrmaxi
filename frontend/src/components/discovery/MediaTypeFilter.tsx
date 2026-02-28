export type MediaType = 'podcast' | 'video' | 'article' | 'all';

interface MediaTypeFilterProps {
  value: MediaType;
  onChange: (type: MediaType) => void;
}

const ITEMS: Array<{ value: MediaType; label: string }> = [
  { value: 'podcast', label: 'Podcasts' },
  { value: 'video', label: 'Videos' },
  { value: 'article', label: 'Articles' },
  { value: 'all', label: 'All Media' },
];

export function MediaTypeFilter({ value, onChange }: MediaTypeFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {ITEMS.map((item) => (
        <button
          key={item.value}
          type="button"
          className={`cy-chip text-sm ${value === item.value ? 'border-cyan-300 text-cyan-100 shadow-[0_0_14px_rgba(0,212,255,0.25)]' : ''}`}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
