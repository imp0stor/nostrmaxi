import { useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useBookmarks } from '../hooks/useBookmarks';
import { BookmarkFolders } from '../components/bookmarks/BookmarkFolders';
import { BookmarkCard } from '../components/bookmarks/BookmarkCard';
import { AddNoteModal } from '../components/bookmarks/AddNoteModal';
import { PinnedPost } from '../components/bookmarks/PinnedPost';
import { PublicListCard } from '../components/bookmarks/PublicListCard';
import { CreatePublicList } from '../components/bookmarks/CreatePublicList';
import { usePinnedPost } from '../hooks/usePinnedPost';
import { usePublicLists } from '../hooks/usePublicLists';
import type { Bookmark } from '../lib/bookmarkEncryption';

type BookmarkTab = 'private' | 'pinned' | 'public-lists';

export function BookmarksPage() {
  const { user } = useAuth();
  const {
    bookmarks,
    isLoading,
    isEncrypted,
    encryptionMethod,
    addBookmark,
    removeBookmark,
    createFolder,
    moveToFolder,
    updateNote,
    setPrivacyMode,
  } = useBookmarks(user?.pubkey);

  const { pinnedPost, removePin } = usePinnedPost(user?.pubkey);
  const { lists: publicLists, isLoading: listsLoading, saveList } = usePublicLists(user?.pubkey);

  const [activeFolder, setActiveFolder] = useState('all');
  const [pendingEventId, setPendingEventId] = useState('');
  const [noteTarget, setNoteTarget] = useState<Bookmark | null>(null);
  const [activeTab, setActiveTab] = useState<BookmarkTab>('private');

  const filtered = useMemo(() => {
    if (activeFolder === 'all') return bookmarks.bookmarks;
    return bookmarks.bookmarks.filter((item) => item.folder === activeFolder);
  }, [activeFolder, bookmarks.bookmarks]);

  return (
    <div className="nm-page max-w-5xl">
      <section className="cy-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="cy-kicker">BOOKMARKS</p>
            <h1 className="text-2xl font-semibold text-cyan-100">🔖 My Bookmarks</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button className={`cy-chip ${activeTab === 'private' ? 'border-cyan-300 text-cyan-100' : ''}`} onClick={() => setActiveTab('private')}>🔒 Private</button>
            <button className={`cy-chip ${activeTab === 'pinned' ? 'border-cyan-300 text-cyan-100' : ''}`} onClick={() => setActiveTab('pinned')}>📌 Pinned</button>
            <button className={`cy-chip ${activeTab === 'public-lists' ? 'border-cyan-300 text-cyan-100' : ''}`} onClick={() => setActiveTab('public-lists')}>📚 Public Lists</button>
          </div>
        </div>

        {activeTab === 'private' ? (
          <>
            <div className="flex items-center gap-2">
              <button className={`cy-chip ${isEncrypted ? 'border-cyan-300 text-cyan-100' : ''}`} onClick={() => setPrivacyMode(true)}>🔒 Private</button>
              <button className={`cy-chip ${!isEncrypted ? 'border-cyan-300 text-cyan-100' : ''}`} onClick={() => setPrivacyMode(false)}>🌐 Public</button>
            </div>

            <p className="text-sm text-cyan-300/80">
              Mode: {isEncrypted ? `Encrypted (${encryptionMethod || 'nip04'})` : 'Public tags'}
            </p>

            <div className="flex gap-2">
              <input
                className="cy-input flex-1"
                value={pendingEventId}
                onChange={(e) => setPendingEventId(e.target.value)}
                placeholder="Paste event ID to add"
              />
              <button
                className="cy-btn"
                onClick={async () => {
                  if (!pendingEventId.trim()) return;
                  await addBookmark(pendingEventId.trim());
                  setPendingEventId('');
                }}
              >
                + Add
              </button>
            </div>

            <BookmarkFolders
              folders={bookmarks.folders}
              activeFolder={activeFolder}
              onChange={setActiveFolder}
              onCreate={async () => {
                const name = prompt('Folder name');
                if (!name) return;
                await createFolder(name, '📂');
              }}
            />
          </>
        ) : null}
      </section>

      {activeTab === 'pinned' ? (
        <PinnedPost pinnedEventId={pinnedPost?.eventId} onRemove={removePin} />
      ) : null}

      {activeTab === 'public-lists' ? (
        <section className="space-y-3">
          <CreatePublicList
            onCreate={async ({ id, title, description }) => {
              await saveList({ id, title, description, eventIds: [] });
            }}
          />
          {listsLoading ? <div className="cy-card p-4">Loading public lists…</div> : null}
          {publicLists.map((list) => <PublicListCard key={list.id} list={list} />)}
          {!listsLoading && publicLists.length === 0 ? <div className="cy-card p-4 text-cyan-300/80">No public lists yet.</div> : null}
        </section>
      ) : null}

      {activeTab === 'private' ? (
        <section className="space-y-3">
          {isLoading ? <div className="cy-card p-4">Loading bookmarks…</div> : null}
          {!isLoading && filtered.length === 0 ? <div className="cy-card p-4 text-cyan-300/80">No bookmarks yet.</div> : null}

          {filtered.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              folders={bookmarks.folders}
              onRemove={removeBookmark}
              onEditNote={setNoteTarget}
              onMove={moveToFolder}
            />
          ))}
        </section>
      ) : null}

      {noteTarget ? (
        <AddNoteModal
          initialValue={noteTarget.note || ''}
          onClose={() => setNoteTarget(null)}
          onSave={async (note) => {
            await updateNote(noteTarget.id, note);
          }}
        />
      ) : null}
    </div>
  );
}
