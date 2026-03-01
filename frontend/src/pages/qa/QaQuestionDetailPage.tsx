import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MarkdownContent } from '../../components/MarkdownContent';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import type { QaQuestionDetail } from '../../types/qa';

const toSats = (msats: number) => Math.floor((msats || 0) / 1000);

export function QaQuestionDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [question, setQuestion] = useState<QaQuestionDetail | null>(null);
  const [answerBody, setAnswerBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canAccept = useMemo(() => user?.pubkey && question?.authorPubkey === user.pubkey, [question, user?.pubkey]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const next = await api.getQuestion(id);
      setQuestion(next);
    } catch (err: any) {
      setError(err?.message || 'Failed to load question');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const onPostAnswer = async (e: FormEvent) => {
    e.preventDefault();
    if (!answerBody.trim()) return;
    await api.createAnswer(id, { body: answerBody });
    setAnswerBody('');
    await load();
  };

  const onVote = async (answerId: string, direction: 'up' | 'down') => {
    await api.voteAnswer(answerId, direction);
    await load();
  };

  const onAccept = async (answerId: string) => {
    await api.acceptAnswer(id, answerId);
    await load();
  };

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8 text-slate-200">Loading…</div>;
  if (error || !question) return <div className="max-w-4xl mx-auto px-4 py-8 text-red-400">{error || 'Not found'}</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-slate-100 space-y-4">
      <div className="rounded border border-slate-800 bg-black p-5">
        <h1 className="text-2xl font-bold text-orange-300 mb-2">{question.title}</h1>
        <div className="text-xs text-slate-400 mb-3">{question.viewCount} views · {question.answers.length} answers</div>
        {question.bountyMsats > 0 && <div className="inline-block mb-3 rounded bg-orange-500/20 text-orange-300 px-2 py-1 text-sm font-semibold">Bounty: {toSats(question.bountyMsats)} sats</div>}
        <MarkdownContent text={question.body} />
      </div>

      <div className="space-y-3">
        {question.answers.map((answer) => (
          <div key={answer.id} className={`rounded border p-4 ${answer.isAccepted ? 'border-orange-400 bg-orange-950/10' : 'border-slate-800 bg-black'}`}>
            <div className="flex justify-between items-start gap-3">
              <div className="flex gap-2">
                <button onClick={() => onVote(answer.id, 'up')} className="px-2 py-1 rounded border border-slate-700 hover:border-orange-400">▲</button>
                <button onClick={() => onVote(answer.id, 'down')} className="px-2 py-1 rounded border border-slate-700 hover:border-orange-400">▼</button>
                <div className="text-sm text-slate-300 self-center">{answer.upvotes - answer.downvotes}</div>
              </div>
              {canAccept && !question.acceptedAnswerId && (
                <button onClick={() => onAccept(answer.id)} className="text-xs px-2 py-1 rounded bg-orange-500 text-black font-semibold">Accept</button>
              )}
              {answer.isAccepted && <span className="text-xs text-orange-300 font-semibold">Accepted ✓</span>}
            </div>
            <div className="mt-3"><MarkdownContent text={answer.body} /></div>
          </div>
        ))}
      </div>

      <form onSubmit={onPostAnswer} className="rounded border border-slate-800 bg-black p-4 space-y-2">
        <h2 className="font-semibold">Your Answer</h2>
        <textarea value={answerBody} onChange={(e) => setAnswerBody(e.target.value)} required minLength={5} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 min-h-[140px]" />
        <button className="px-4 py-2 rounded bg-orange-500 text-black font-semibold">Post Answer</button>
      </form>
    </div>
  );
}
