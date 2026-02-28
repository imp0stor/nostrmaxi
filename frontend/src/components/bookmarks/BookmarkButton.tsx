import { useState } from 'react';
import { useBookmarks } from '../../hooks/useBookmarks';

interface BookmarkButtonProps {
  eventId: string;
  pubkey?: string | null;
}

export function BookmarkButton({ eventId, pubkey }: BookmarkButtonProps) {
  const { bookmarks, isBookmarked, addBookmark, removeBookmark, createFolder, isEncrypted, setPrivacyMode } = useBookmarks(pubkey);
  const [open, setOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('');

  const bookmarked = isBookmarked(eventId);

  return (
    <div className="relative">
      <button className="cy-chip" onClick={() => setOpen((v) => !v)}>
        {bookmarked ? '🔖 Bookmarked' : '🔖 Bookmark'} ▼
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-72 cy-card p-3 z-30 space-y-2">
          <p className="text-xs text-cyan-400">Folder</p>
          <select className="cy-input w-full" value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)}>
            <option value="">No folder</option>
            {bookmarks.folders.map((folder) => (
              <option key={folder.id} value={folder.id}>{folder.icon || '📂'} {folder.name}</option>
            ))}
          </select>

          <div className="flex gap-2 pt-1">
            <button
              className="cy-btn"
              onClick={async () => {
                if (bookmarked) {
                  await removeBookmark(eventId);
                } else {
                  await addBookmark(eventId, { folder: selectedFolder || undefined });
                }
                setOpen(false);
              }}
            >
              {bookmarked ? 'Remove' : 'Save'}
            </button>
            <button
              className="cy-chip"
              onClick={async () => {
                const name = prompt('Folder name');
                if (!name) return;
                const folder = await createFolder(name, '📂');
                setSelectedFolder(folder.id);
              }}
            >
              + New Folder
            </button>
          </div>

          <div className="border-t border-swordfish-muted/30 pt-2 flex gap-2">
            <button className={`cy-chip ${isEncrypted ? 'border-cyan-300 text-cyan-100' : ''}`} onClick={() => setPrivacyMode(true)}>🔒 Private</button>
            <button className={`cy-chip ${!isEncrypted ? 'border-cyan-300 text-cyan-100' : ''}`} onClick={() => setPrivacyMode(false)}>🌐 Public</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
