import { useEffect, useMemo, useState, type ReactNode } from 'react';

type CollapsibleSectionProps = {
  id: string;
  title: string;
  subtitle?: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
};

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function CollapsibleSection({
  id,
  title,
  subtitle,
  summary,
  defaultOpen = false,
  className,
  contentClassName,
  rightSlot,
  children,
}: CollapsibleSectionProps) {
  const storageKey = useMemo(() => `nostrmaxi.section.${id}.open`, [id]);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === '1') setOpen(true);
    if (stored === '0') setOpen(false);
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, open ? '1' : '0');
  }, [storageKey, open]);

  return (
    <section className={clsx('cy-card cinematic-card', className)}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex-1 text-left min-h-11"
            aria-expanded={open}
          >
            <p className="cy-kicker">{open ? 'EXPANDED' : 'COLLAPSED'}</p>
            <div className="mt-1 flex items-center gap-2">
              <h3 className="text-cyan-100 text-base sm:text-lg font-semibold tracking-[0.06em]">{title}</h3>
              <span className="text-cyan-300 text-xs">{open ? '▾' : '▸'}</span>
            </div>
            {subtitle ? <p className="text-xs text-neutral-300 mt-1">{subtitle}</p> : null}
            {!open && summary ? <div className="mt-2 text-xs text-cyan-300/90">{summary}</div> : null}
          </button>
          {rightSlot ? <div className="pt-1">{rightSlot}</div> : null}
        </div>
      </div>
      {open ? <div className={clsx('px-4 pb-4 sm:px-5 sm:pb-5 space-y-4 animate-content-fade-cinematic', contentClassName)}>{children}</div> : null}
    </section>
  );
}
