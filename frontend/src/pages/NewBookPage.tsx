import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export function NewBookPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api.createBook({ title, description, coverUrl });
      navigate(`/books/${created.id}/edit`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create book');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-orange-100">
      <h1 className="text-2xl font-bold mb-4">Create Book</h1>
      <form onSubmit={onSubmit} className="space-y-3 rounded border border-orange-500/40 bg-black p-5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title" required className="w-full rounded border border-orange-500/40 bg-black p-2" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full rounded border border-orange-500/40 bg-black p-2 min-h-28" />
        <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="Cover image URL" className="w-full rounded border border-orange-500/40 bg-black p-2" />
        {error ? <div className="text-red-300 text-sm">{error}</div> : null}
        <button type="submit" disabled={saving} className="rounded bg-orange-500 px-3 py-2 text-black font-semibold disabled:opacity-70">{saving ? 'Creating…' : 'Create Book'}</button>
      </form>
    </div>
  );
}
