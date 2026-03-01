import type { ReactNode } from 'react';

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}

export function ModalShell({ title, onClose, children, maxWidthClass = 'max-w-xl' }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center" onClick={onClose} role="presentation">
      <div className={`cy-card w-full ${maxWidthClass} p-4 space-y-4 max-h-[85vh] overflow-auto`} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-orange-100">{title}</h3>
          <button type="button" className="cy-chip" onClick={onClose} aria-label={`Close ${title}`}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
