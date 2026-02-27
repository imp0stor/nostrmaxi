import type { ReactNode } from 'react';

interface DiscoverSectionProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function DiscoverSection({ title, subtitle, children }: DiscoverSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-cyan-100">{title}</h2>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
