import { Link } from 'react-router-dom';
import { Avatar } from '../Avatar';
import { ModalShell } from './ModalShell';

interface ContributorEntry {
  pubkey: string;
  count: number;
  name?: string;
}

interface ContributorSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  sections: Array<{ label: string; items: ContributorEntry[] }>;
}

export function ContributorSheet({ open, title, onClose, sections }: ContributorSheetProps) {
  if (!open) return null;

  return (
    <ModalShell title={title} onClose={onClose} maxWidthClass="max-w-xl">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="text-xs text-cyan-300 mb-2">{section.label}</p>
          <div className="space-y-2">
            {section.items.length === 0 ? <p className="text-xs text-slate-400">No contributors yet.</p> : section.items.map((entry) => (
              <Link key={`${section.label}-${entry.pubkey}`} to={`/profile/${entry.pubkey}`} className="flex items-center justify-between rounded-md border border-cyan-500/30 px-2 py-1.5 hover:border-orange-300/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/80">
                <span className="flex items-center gap-2"><Avatar pubkey={entry.pubkey} size={22} /><span>{entry.name || entry.pubkey.slice(0, 8)}</span></span>
                <span className="text-xs text-cyan-200">{entry.count}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </ModalShell>
  );
}
