import { type ReactNode } from 'react';
import { CollapsibleSection } from './CollapsibleSection';

type ConfigAccordionProps = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  rightSlot?: ReactNode;
  id?: string;
  summary?: ReactNode;
};

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function ConfigAccordion({ title, subtitle, defaultOpen = false, children, rightSlot, id, summary }: ConfigAccordionProps) {
  return (
    <CollapsibleSection
      id={id || `config-${slugify(title)}`}
      title={title}
      subtitle={subtitle}
      summary={summary}
      defaultOpen={defaultOpen}
      rightSlot={rightSlot}
    >
      {children}
    </CollapsibleSection>
  );
}
