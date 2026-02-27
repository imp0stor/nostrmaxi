import { useState, type ReactNode } from 'react';

type ConfigAccordionProps = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  rightSlot?: ReactNode;
};

export function ConfigAccordion({ title, subtitle, defaultOpen = false, children, rightSlot }: ConfigAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="cy-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 text-left"
          aria-expanded={open}
        >
          <p className="cy-kicker">CONFIG</p>
          <p className="text-cyan-100 font-semibold mt-1">{title} <span className="text-xs text-cyan-400">{open ? '▾' : '▸'}</span></p>
          {subtitle ? <p className="text-xs text-blue-300 mt-1">{subtitle}</p> : null}
        </button>
        {rightSlot}
      </div>
      {open ? <div className="space-y-3">{children}</div> : null}
    </section>
  );
}
