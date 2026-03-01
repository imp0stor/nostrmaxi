import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { DesignPicker } from '../components/DesignPicker';

const PRESETS = [10_000, 50_000, 100_000, 500_000];

export function GiftCardsPage() {
  const [designs, setDesigns] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [amountSats, setAmountSats] = useState(10_000);
  const [designName, setDesignName] = useState('bitcoin');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const redemptionPreviewCode = useMemo(() => mine[0]?.code || 'XXXX-XXXX-XXXX', [mine]);

  const refresh = async () => {
    const [availableDesigns, cards] = await Promise.all([api.getGiftCardDesigns(), api.listMyGiftCards()]);
    setDesigns(availableDesigns);
    setMine(cards);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const createCard = async () => {
    setLoading(true);
    setError('');
    try {
      const card = await api.createGiftCard({ amountSats, designName, message: message || undefined });
      await api.fundGiftCard(card.code, `demo-${Date.now()}`);
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to create gift card');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 text-zinc-100">
      <h1 className="text-3xl font-bold text-orange-300">Gift Cards</h1>
      <p className="text-zinc-400 mt-2">Create a Bitcoin gift card, fund it over Lightning, and share the redemption code.</p>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <section className="rounded-2xl border border-zinc-800 bg-black p-5">
          <h2 className="text-xl font-semibold text-orange-200">Create Card</h2>

          <div className="mt-4">
            <div className="text-sm text-zinc-400 mb-2">Amount (sats)</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  className={`px-3 py-1 rounded-lg border text-sm ${amountSats === preset ? 'border-orange-400 bg-orange-500/20 text-orange-100' : 'border-zinc-700 text-zinc-300'}`}
                  onClick={() => setAmountSats(preset)}
                >
                  {preset.toLocaleString()}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={amountSats}
              onChange={(e) => setAmountSats(Number(e.target.value || 0))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </div>

          <div className="mt-4">
            <div className="text-sm text-zinc-400 mb-2">Design</div>
            <DesignPicker designs={designs} selected={designName} onSelect={setDesignName} />
          </div>

          <div className="mt-4">
            <div className="text-sm text-zinc-400 mb-2">Message (optional)</div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
              rows={3}
            />
          </div>

          {error ? <div className="mt-3 text-sm text-red-400">{error}</div> : null}
          <button
            disabled={loading || amountSats < 1}
            onClick={createCard}
            className="mt-4 w-full rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-black font-semibold py-2"
          >
            {loading ? 'Creating…' : 'Create + Fund Card'}
          </button>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-black p-5">
          <h2 className="text-xl font-semibold text-orange-200">Card Preview</h2>
          <div className="mt-4 rounded-xl border border-orange-500/40 bg-zinc-950 p-4">
            <div className="text-xs uppercase text-zinc-500">NostrMaxi Gift Card</div>
            <div className="text-2xl font-bold text-orange-300 mt-2">{amountSats.toLocaleString()} sats</div>
            <div className="text-zinc-300 mt-2 min-h-[24px]">{message || 'Your message appears here'}</div>
            <div className="mt-4 text-sm text-zinc-400">Code: <span className="text-orange-200 font-mono">{redemptionPreviewCode}</span></div>
            <div className="text-xs text-zinc-500 mt-2">Redemption URL: {window.location.origin}/gift-cards/redeem?code={redemptionPreviewCode}</div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-black p-5 mt-6">
        <h2 className="text-xl font-semibold text-orange-200">My Gift Cards</h2>
        <div className="mt-4 space-y-3">
          {mine.map((card) => (
            <div key={card.id} className="rounded-lg border border-zinc-800 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <div className="font-mono text-orange-200">{card.code}</div>
                <div className="text-sm text-zinc-400">{card.remainingSats.toLocaleString()} / {card.amountSats.toLocaleString()} sats · {card.status}</div>
              </div>
              <button
                className="text-xs px-2 py-1 rounded border border-zinc-700"
                onClick={() => navigator.clipboard.writeText(card.code)}
              >
                Copy code
              </button>
            </div>
          ))}
          {!mine.length ? <div className="text-zinc-500 text-sm">No cards yet.</div> : null}
        </div>
      </section>
    </div>
  );
}
