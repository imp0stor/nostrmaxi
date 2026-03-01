import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

export function QaAskPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('nostr');
  const [bountySats, setBountySats] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const created = await api.createQuestion({
        title,
        body,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        bountySats,
      });
      navigate(`/qa/questions/${created.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create question');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-slate-100">
      <h1 className="text-2xl font-bold text-orange-300 mb-6">Ask a Question</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded border border-slate-800 bg-black p-4">
        <div>
          <label className="block text-sm mb-1">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" required minLength={10} />
        </div>
        <div>
          <label className="block text-sm mb-1">Body (Markdown)</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 min-h-[180px]" required minLength={20} />
        </div>
        <div>
          <label className="block text-sm mb-1">Tags (comma separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" required />
        </div>
        <div>
          <label className="block text-sm mb-1">Bounty (sats)</label>
          <input value={bountySats} onChange={(e) => setBountySats(Number(e.target.value || 0))} type="number" min={0} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" />
        </div>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button disabled={submitting} className="px-4 py-2 rounded bg-orange-500 text-black font-semibold hover:bg-orange-400 disabled:opacity-60">
          {submitting ? 'Posting…' : 'Post Question'}
        </button>
      </form>
    </div>
  );
}
