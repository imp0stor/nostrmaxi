import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import type { QaQuestionSummary } from '../../types/qa';

const toSats = (msats: number) => Math.floor((msats || 0) / 1000);

export function QaListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [questions, setQuestions] = useState<QaQuestionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const sort = (searchParams.get('sort') as 'recent' | 'votes' | 'bounty') || 'recent';
  const tag = searchParams.get('tag') || '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listQuestions(tag || undefined, sort)
      .then((result) => !cancelled && setQuestions(result))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [tag, sort]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 text-slate-100">
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold tracking-wide text-orange-300">Q&A</h1>
        <Link to="/qa/ask" className="px-4 py-2 rounded bg-orange-500 text-black font-semibold hover:bg-orange-400">Ask Question</Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(['recent', 'votes', 'bounty'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSearchParams((p) => { p.set('sort', s); if (tag) p.set('tag', tag); return p; })}
            className={`px-3 py-1 rounded border text-sm ${sort === s ? 'border-orange-400 text-orange-300' : 'border-slate-700 text-slate-300'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? <div>Loading questions…</div> : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="rounded border border-slate-800 bg-black p-4">
              <div className="flex flex-wrap gap-3 text-sm text-slate-400 mb-2">
                <span>{q.voteCount} votes</span>
                <span>{q.answerCount} answers</span>
                <span>{q.viewCount} views</span>
                {q.bountyMsats > 0 && <span className="text-orange-300 font-semibold">🔥 {toSats(q.bountyMsats)} sats bounty</span>}
              </div>
              <Link to={`/qa/questions/${q.id}`} className="text-lg font-semibold text-slate-100 hover:text-orange-300">{q.title}</Link>
              <div className="mt-2 flex flex-wrap gap-2">
                {q.tags.map((t) => (
                  <button key={t} onClick={() => setSearchParams({ tag: t, sort })} className="text-xs bg-orange-950/50 text-orange-200 px-2 py-1 rounded">#{t}</button>
                ))}
              </div>
            </div>
          ))}
          {!questions.length && <div className="text-slate-400">No questions found.</div>}
        </div>
      )}
    </div>
  );
}
