import type { BookmarkFolder } from '../../lib/bookmarkEncryption';

interface BookmarkFoldersProps {
  folders: BookmarkFolder[];
  activeFolder: string;
  onChange: (folderId: string) => void;
  onCreate: () => void;
}

export function BookmarkFolders({ folders, activeFolder, onChange, onCreate }: BookmarkFoldersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button className={`cy-chip ${activeFolder === 'all' ? 'border-cyan-300 text-cyan-100' : ''}`} onClick={() => onChange('all')}>All</button>
      {folders.map((folder) => (
        <button
          key={folder.id}
          className={`cy-chip ${activeFolder === folder.id ? 'border-cyan-300 text-cyan-100' : ''}`}
          onClick={() => onChange(folder.id)}
          title={folder.name}
        >
          {folder.icon || '📂'} {folder.name}
        </button>
      ))}
      <button className="cy-chip" onClick={onCreate}>+ New Folder</button>
    </div>
  );
}
