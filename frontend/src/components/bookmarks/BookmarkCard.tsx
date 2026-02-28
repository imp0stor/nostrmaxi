import { Link } from 'react-router-dom';
import type { Bookmark, BookmarkFolder } from '../../lib/bookmarkEncryption';

interface BookmarkCardProps {
  bookmark: Bookmark;
  folders: BookmarkFolder[];
  onRemove: (eventId: string) => Promise<void> | void;
  onEditNote: (bookmark: Bookmark) => void;
  onMove: (eventId: string, folderId?: string) => Promise<void> | void;
}

export function BookmarkCard({ bookmark, folders, onRemove, onEditNote, onMove }: BookmarkCardProps) {
  const folder = folders.find((f) => f.id === bookmark.folder);

  return (
    <article className="cy-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-cyan-200 break-all">Event: {bookmark.id}</p>
          <p className="text-xs text-cyan-400 mt-1">
            {folder ? `${folder.icon || '📂'} ${folder.name}` : 'Unfiled'} • Added {new Date(bookmark.addedAt * 1000).toLocaleString()}
          </p>
          {bookmark.note ? <p className="mt-2 text-sm text-swordfish-text">Note: {bookmark.note}</p> : null}
        </div>
        <Link className="cy-chip" to={`/discover?event=${bookmark.id}`}>View</Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className="cy-chip" onClick={() => onEditNote(bookmark)}>Edit Note</button>
        <select className="cy-input max-w-56" value={bookmark.folder || ''} onChange={(e) => onMove(bookmark.id, e.target.value || undefined)}>
          <option value="">No folder</option>
          {folders.map((folderOption) => <option key={folderOption.id} value={folderOption.id}>{folderOption.icon || '📂'} {folderOption.name}</option>)}
        </select>
        <button className="cy-chip" onClick={() => onRemove(bookmark.id)}>Remove</button>
      </div>
    </article>
  );
}
