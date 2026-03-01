import { useMemo } from 'react';

export type TimeRangeValue = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom';

interface TimeRangePickerProps {
  value: TimeRangeValue;
  onChange: (range: TimeRangeValue, start?: Date, end?: Date) => void;
  customStart?: Date | null;
  customEnd?: Date | null;
}

const OPTIONS: { value: TimeRangeValue; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'ALL' },
  { value: 'custom', label: 'Custom' },
];

function toInputDate(date?: Date | null): string {
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}

export function TimeRangePicker({ value, onChange, customStart, customEnd }: TimeRangePickerProps) {
  const startValue = useMemo(() => toInputDate(customStart), [customStart]);
  const endValue = useMemo(() => toInputDate(customEnd), [customEnd]);

  return (
    <div className="cy-card p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value, customStart ?? undefined, customEnd ?? undefined)}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm border transition-all duration-200 ${
                active
                  ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100 shadow-[0_0_16px_rgba(0,212,255,0.45)]'
                  : 'border-cyan-800/70 text-neutral-300 hover:text-cyan-200 hover:bg-cyan-500/10'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {value === 'custom' && (
        <div className="grid sm:grid-cols-2 gap-3 pt-1">
          <label className="text-xs text-neutral-300 space-y-1">
            <span>Start date</span>
            <input
              type="date"
              value={startValue}
              onChange={(e) => {
                const start = e.target.value ? new Date(`${e.target.value}T00:00:00`) : undefined;
                onChange('custom', start, customEnd ?? undefined);
              }}
              className="w-full rounded-md border border-cyan-800/70 bg-[#0a0f1a]/80 px-3 py-2 text-cyan-100 outline-none focus:border-cyan-400"
            />
          </label>
          <label className="text-xs text-neutral-300 space-y-1">
            <span>End date</span>
            <input
              type="date"
              value={endValue}
              onChange={(e) => {
                const end = e.target.value ? new Date(`${e.target.value}T23:59:59`) : undefined;
                onChange('custom', customStart ?? undefined, end);
              }}
              className="w-full rounded-md border border-cyan-800/70 bg-[#0a0f1a]/80 px-3 py-2 text-cyan-100 outline-none focus:border-cyan-400"
            />
          </label>
        </div>
      )}
    </div>
  );
}
