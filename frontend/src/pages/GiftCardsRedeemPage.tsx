import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

export function GiftCardsRedeemPage() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [card, setCard] = useState<any>(null);
  const [invoice, setInvoice] = useState('');
  const [lightningAddress, setLightningAddress] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const lookup = async (targetCode = code) => {
    setError('');
    try {
      const balance = await api.getGiftCardBalance(targetCode.trim());
      setCard(balance);
    } catch (err: any) {
      setError(err?.message || 'Could not load card');
      setCard(null);
    }
  };

  useEffect(() => {
    if (code) {
      void lookup(code);
    }
  }, []);

  const redeem = async () => {
    setError('');
    try {
      const payload: any = {};
      if (invoice) payload.invoice = invoice;
      if (lightningAddress) payload.lightningAddress = lightningAddress;
      const redeemed = await api.redeemGiftCard(code, payload);
      setResult(redeemed);
      await lookup(code);
    } catch (err: any) {
      setError(err?.message || 'Redeem failed');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-zinc-100">
      <h1 className="text-3xl font-bold text-orange-300">Redeem Gift Card</h1>

      <div className="rounded-2xl border border-zinc-800 bg-black p-5 mt-6">
        <label className="text-sm text-zinc-400">Redemption code</label>
        <div className="flex gap-2 mt-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono"
            placeholder="XXXX-XXXX-XXXX"
          />
          <button onClick={() => lookup()} className="rounded-lg bg-zinc-800 px-4">Check</button>
        </div>

        {card ? (
          <div className="mt-4 rounded-xl border border-orange-500/30 p-4 bg-zinc-950">
            <div className="text-zinc-400 text-sm">Available balance</div>
            <div className="text-2xl font-bold text-orange-300">{card.remainingSats.toLocaleString()} sats</div>
            <div className="text-zinc-300 mt-2">{card.message || 'No message'}</div>
            <div className="text-xs text-zinc-500 mt-2">Status: {card.status}</div>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          <input
            value={invoice}
            onChange={(e) => setInvoice(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            placeholder="Paste Lightning invoice (optional if using LN address)"
          />
          <input
            value={lightningAddress}
            onChange={(e) => setLightningAddress(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            placeholder="or enter lightning address (name@domain.com)"
          />
        </div>

        <button onClick={redeem} className="mt-4 w-full rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-semibold py-2">
          Redeem
        </button>

        {error ? <div className="text-sm text-red-400 mt-3">{error}</div> : null}
        {result ? (
          <div className="text-sm text-emerald-400 mt-3">
            Redeemed {result.redeemedSats?.toLocaleString()} sats. Remaining: {result.remainingSats?.toLocaleString()} sats.
          </div>
        ) : null}
      </div>
    </div>
  );
}
