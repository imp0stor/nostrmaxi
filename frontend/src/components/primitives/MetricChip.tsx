interface MetricChipProps {
  label: string;
  value: string | number;
  onClick?: () => void;
  active?: boolean;
  ariaLabel?: string;
}

export function MetricChip({ label, value, onClick, active = false, ariaLabel }: MetricChipProps) {
  const activeClass = active ? 'border-orange-300/80 text-orange-100 shadow-[0_0_16px_rgba(249,115,22,0.28)]' : '';

  if (onClick) {
    return (
      <button
        type="button"
        className={`cy-chip text-sm ${activeClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/80`}
        onClick={onClick}
        aria-label={ariaLabel || `${label}: ${value}`}
      >
        <span className="text-slate-300">{label}</span>
        <span className="ml-1 font-semibold">{value}</span>
      </button>
    );
  }

  return (
    <span className={`cy-chip cy-chip-static text-sm ${activeClass}`} aria-label={ariaLabel || `${label}: ${value}`}>
      <span className="text-slate-300">{label}</span>
      <span className="ml-1 font-semibold">{value}</span>
    </span>
  );
}
