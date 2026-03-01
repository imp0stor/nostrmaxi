import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Book, BookChapter } from '../types';
import { MarkdownEditor } from '../components/books/MarkdownEditor';

export function EditBookPage() {
  const { id } = useParams();
  const [book, setBook] = useState<Book | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [preview, setPreview] = useState(true);
  const [message, setMessage] = useState<string>('');
  const autosaveTimer = useRef<number | null>(null);

  const activeChapter = useMemo(() => {
    if (!book || !activeChapterId) return null;
    return book.chapters.find((ch) => ch.id === activeChapterId) || null;
  }, [book, activeChapterId]);

  useEffect(() => {
    if (!id) return;
    let canceled = false;
    const run = async () => {
      const data = await api.getBook(id);
      if (!canceled) {
        setBook(data);
        setActiveChapterId(data.chapters[0]?.id || null);
      }
    };
    void run();
    return () => { canceled = true; };
  }, [id]);

  const refresh = async () => {
    if (!id) return;
    const data = await api.getBook(id);
    setBook(data);
    if (!activeChapterId && data.chapters[0]) setActiveChapterId(data.chapters[0].id);
  };

  const addChapter = async () => {
    if (!id) return;
    const next = await api.createChapter(id, { title: `Chapter ${(book?.chapters.length || 0) + 1}`, content: '' });
    await refresh();
    setActiveChapterId(next.id);
  };

  const onEditChapter = (next: Partial<BookChapter>) => {
    if (!book || !activeChapter) return;
    const updated = {
      ...book,
      chapters: book.chapters.map((ch) => (ch.id === activeChapter.id ? { ...ch, ...next } : ch)),
    };
    setBook(updated);

    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(async () => {
      if (!id || !activeChapter) return;
      await api.updateChapter(id, activeChapter.id, {
        title: next.title ?? activeChapter.title,
        content: next.content ?? activeChapter.content,
      });
      setMessage('Draft autosaved');
    }, 500);
  };

  const reorder = async (chapterId: string, orderIndex: number) => {
    if (!id) return;
    await api.updateChapter(id, chapterId, { orderIndex });
    await refresh();
  };

  const publish = async () => {
    if (!id) return;
    await api.publishBook(id);
    await refresh();
    setMessage('Published to Nostr long-form event');
  };

  const doExport = async (format: 'pdf' | 'epub') => {
    if (!id) return;
    const result = await api.exportBook(id, format);
    setMessage(`${format.toUpperCase()} exported: ${result.downloadUrl}`);
  };

  const loadSales = async () => {
    if (!id) return;
    const sales = await api.getBookSales(id);
    setMessage(`Sales: ${sales.totalEarningsSats} sats, buyers: ${sales.buyerCount}`);
  };

  if (!book) return <div className="max-w-5xl mx-auto px-4 py-8 text-orange-100">Loading book…</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-orange-100">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">{book.title}</h1>
          <p className="text-sm text-orange-300/70">Status: {book.status}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={addChapter} className="rounded border border-orange-500/50 bg-black px-3 py-1.5">Add chapter</button>
          <button onClick={publish} className="rounded bg-orange-500 text-black font-semibold px-3 py-1.5">Publish</button>
          <button onClick={() => doExport('pdf')} className="rounded border border-orange-500/50 bg-black px-3 py-1.5">Export PDF</button>
          <button onClick={() => doExport('epub')} className="rounded border border-orange-500/50 bg-black px-3 py-1.5">Export ePub</button>
          <button onClick={loadSales} className="rounded border border-orange-500/50 bg-black px-3 py-1.5">Sales</button>
        </div>
      </div>

      {message ? <div className="mb-3 rounded border border-orange-500/30 bg-black p-2 text-sm">{message}</div> : null}

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <aside className="rounded border border-orange-500/30 bg-black p-3">
          <h2 className="text-sm uppercase tracking-wide text-orange-300 mb-2">Chapters</h2>
          <div className="space-y-2">
            {book.chapters.sort((a, b) => a.orderIndex - b.orderIndex).map((chapter) => (
              <div
                key={chapter.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('chapter-id', chapter.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId = e.dataTransfer.getData('chapter-id');
                  if (!fromId || fromId === chapter.id) return;
                  void reorder(fromId, chapter.orderIndex);
                }}
                onClick={() => setActiveChapterId(chapter.id)}
                className={`cursor-pointer rounded border p-2 text-sm ${activeChapterId === chapter.id ? 'border-orange-400 bg-orange-900/20' : 'border-orange-500/20'}`}
              >
                <p className="font-medium">{chapter.orderIndex + 1}. {chapter.title}</p>
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded border border-orange-500/30 bg-black p-3">
          {activeChapter ? (
            <>
              <div className="flex items-center justify-between gap-2 mb-2">
                <input
                  value={activeChapter.title}
                  onChange={(e) => onEditChapter({ title: e.target.value })}
                  className="w-full rounded border border-orange-500/40 bg-black p-2"
                />
                <button onClick={() => setPreview((v) => !v)} className="rounded border border-orange-500/40 px-3 py-2 text-xs">{preview ? 'Preview: On' : 'Preview: Off'}</button>
              </div>
              <MarkdownEditor
                value={activeChapter.content}
                onChange={(content) => onEditChapter({ content })}
                preview={preview}
              />
            </>
          ) : (
            <div>No chapter selected</div>
          )}
        </section>
      </div>
    </div>
  );
}
