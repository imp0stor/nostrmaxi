interface GiftCardDesign {
  name: string;
  title: string;
  imageUrl: string;
  category: string;
  custom: boolean;
}

interface DesignPickerProps {
  designs: GiftCardDesign[];
  selected: string;
  onSelect: (name: string) => void;
}

export function DesignPicker({ designs, selected, onSelect }: DesignPickerProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {designs.map((design) => {
        const active = selected === design.name;
        return (
          <button
            key={design.name}
            type="button"
            onClick={() => onSelect(design.name)}
            className={`rounded-xl border p-3 text-left transition ${active ? 'border-orange-400 bg-orange-500/15' : 'border-zinc-800 bg-black hover:border-zinc-700'}`}
          >
            <div className="text-sm font-semibold text-orange-200">{design.title}</div>
            <div className="mt-1 text-xs text-zinc-400 uppercase tracking-wide">{design.category}</div>
          </button>
        );
      })}
    </div>
  );
}
