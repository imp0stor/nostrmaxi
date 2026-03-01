import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { loadMutedWords, saveMutedWords } from '../../lib/mutedWords';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.primal.net'];

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[a-f0-9]{64}$/i.test(hex)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function MutedWordsManager() {
  const { user } = useAuth();
  const [words, setWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const privateKey = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const key = sessionStorage.getItem('nostrmaxi_nsec_hex') || '';
    return hexToBytes(key);
  }, [user?.pubkey]);

  useEffect(() => {
    const pubkey = user?.pubkey;
    if (!pubkey || !privateKey) {
      setLoading(false);
      return;
    }

    setLoading(true);
    loadMutedWords(pubkey, privateKey, DEFAULT_RELAYS)
      .then((next) => {
        setWords(next);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load muted words'))
      .finally(() => setLoading(false));
  }, [user?.pubkey, privateKey]);

  const persist = async (nextWords: string[]) => {
    if (!privateKey) {
      setError('Encrypted muted words requires nsec login or a signer with NIP-44 support.');
      return;
    }

    setSaving(true);
    try {
      await saveMutedWords(nextWords, privateKey, DEFAULT_RELAYS);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save muted words');
    } finally {
      setSaving(false);
    }
  };

  const addWord = async () => {
    const normalized = newWord.trim().toLowerCase();
    if (!normalized || words.includes(normalized)) return;

    const updated = [...words, normalized];
    setWords(updated);
    setNewWord('');
    await persist(updated);
  };

  const removeWord = async (word: string) => {
    const updated = words.filter((w) => w !== word);
    setWords(updated);
    await persist(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span role="img" aria-label="encrypted">🔒</span>
        <span>Muted words are encrypted — only you can see them</span>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          placeholder="Add word or phrase to mute..."
          className="flex-1 bg-gray-800 rounded px-3 py-2"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void addWord();
          }}
        />
        <button onClick={() => void addWord()} disabled={saving || loading} className="cy-btn-primary">
          Add
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {words.map((word) => (
          <div key={word} className="bg-gray-700 rounded-full px-3 py-1 flex items-center gap-2">
            <span>{word}</span>
            <button onClick={() => void removeWord(word)} className="text-gray-400 hover:text-red-400" aria-label={`remove ${word}`}>
              ×
            </button>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2" aria-label="Loading muted words">
          <div className="nm-skeleton h-8 w-44 rounded-full" />
          <div className="nm-skeleton h-8 w-36 rounded-full" />
        </div>
      ) : null}
      {saving ? <div className="text-sm text-cyan-400">Saving...</div> : null}
      {error ? <div className="text-sm text-red-400">{error}</div> : null}
    </div>
  );
}
