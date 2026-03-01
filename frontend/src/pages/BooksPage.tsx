import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Book } from '../types';

export function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    const run = async () => {
      setLoading(true);
      try {
        const result = await api.listBooks();
        if (!canceled) setBooks(result);
      } catch (e: any) {
        if (!canceled) setError(e?.message || 'Failed to load books');
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    void run();
    return () => { canceled = true; };
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 text-orange-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">My Books</h1>
        <Link to="/books/new" className="rounded bg-orange-500 px-3 py-2 text-black font-semibold">New Book</Link>
      </div>

      {loading ? <div className="rounded border border-orange-500/40 bg-black p-4">Loading books…</div> : null}
      {error ? <div className="rounded border border-red-500/60 bg-black p-4 text-red-300">{error}</div> : null}

      <div className="grid gap-3">
        {books.map((book) => (
          <Link key={book.id} to={`/books/${book.id}/edit`} className="rounded border border-orange-500/30 bg-black p-4 hover:border-orange-400">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{book.title}</p>
                <p className="text-sm text-orange-300/80">{book.description || 'No description yet.'}</p>
              </div>
              <div className="text-right text-xs text-orange-300/80">
                <p>{book.status.toUpperCase()}</p>
                <p>{book.chapters.length} chapters</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {!loading && books.length === 0 ? (
        <div className="rounded border border-orange-500/30 bg-black p-5 mt-4">No books yet. Start your first manuscript.</div>
      ) : null}
    </div>
  );
}
