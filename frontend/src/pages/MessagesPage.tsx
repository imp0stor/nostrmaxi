import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchProfilesBatchCached, profileDisplayName } from '../lib/profileCache';
import { signEvent, truncateNpub } from '../lib/nostr';
import { deriveConversationList, loadDirectMessages, sendDirectMessage, type DMConversation } from '../lib/directMessages';

function parseNsecHex(): string | null {
  if (typeof window === 'undefined') return null;
  const value = sessionStorage.getItem('nostrmaxi_nsec_hex');
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) return null;
  return value;
}

export function MessagesPage() {
  const { user, isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [manualPubkey, setManualPubkey] = useState('');
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [sendError, setSendError] = useState<string | null>(null);

  const selectedPubkey = searchParams.get('with') || '';
  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.counterpartyPubkey === selectedPubkey) || null,
    [conversations, selectedPubkey],
  );

  const canDecryptWithExtension = typeof window !== 'undefined' && Boolean(window.nostr?.nip04?.decrypt);
  const canEncryptWithExtension = typeof window !== 'undefined' && Boolean(window.nostr?.nip04?.encrypt);
  const nsecHex = parseNsecHex();
  const canDecrypt = Boolean(nsecHex || canDecryptWithExtension);
  const canSend = Boolean(user?.pubkey && (nsecHex || canEncryptWithExtension));

  const refresh = async () => {
    if (!user?.pubkey) return;
    setLoading(true);
    setLoadError(null);

    try {
      const items = await loadDirectMessages({
        mePubkey: user.pubkey,
        myPrivateKeyHex: nsecHex,
        nip04Decrypt: window.nostr?.nip04?.decrypt,
      });
      const convos = deriveConversationList(items);
      setConversations(convos);

      const pubkeys = convos.map((conversation) => conversation.counterpartyPubkey);
      const hydrated = pubkeys.length ? await fetchProfilesBatchCached(pubkeys) : new Map();
      setProfiles(hydrated);

      if (!selectedPubkey && convos.length > 0) {
        setSearchParams({ with: convos[0].counterpartyPubkey }, { replace: true });
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load direct messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !user?.pubkey) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.pubkey]);

  const onSelectConversation = (pubkey: string) => {
    setSearchParams({ with: pubkey });
    setDraft('');
    setSendError(null);
    setSendState('idle');
  };

  const onStartConversation = () => {
    const cleaned = manualPubkey.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(cleaned)) {
      setLoadError('Enter a valid 64-char hex pubkey to open a DM thread.');
      return;
    }

    setLoadError(null);
    setSearchParams({ with: cleaned });
    setManualPubkey('');
  };

  const onSend = async () => {
    if (!user?.pubkey || !selectedPubkey || !draft.trim()) return;
    setSendState('sending');
    setSendError(null);

    try {
      await sendDirectMessage({
        senderPubkey: user.pubkey,
        recipientPubkey: selectedPubkey,
        message: draft,
        myPrivateKeyHex: nsecHex,
        nip04Encrypt: window.nostr?.nip04?.encrypt,
        signEventFn: signEvent,
      });

      setDraft('');
      setSendState('sent');
      await refresh();
      setTimeout(() => setSendState('idle'), 1500);
    } catch (error) {
      setSendState('error');
      setSendError(error instanceof Error ? error.message : 'Failed to send direct message');
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="cy-card p-8 text-center">
          <h2 className="cy-title">Login required for DMs</h2>
          <p className="cy-muted mt-2">Authenticate to access private message threads.</p>
          <Link to="/" className="cy-btn mt-6 inline-block">Return home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <section className="cy-card p-4">
        <h1 className="text-2xl font-semibold text-cyan-100">💬 Direct Messages</h1>
        <p className="cy-muted mt-1">NIP-04 private messaging shell with safe fallbacks.</p>
        {!canDecrypt ? <p className="text-xs text-amber-300 mt-2">Cannot decrypt existing messages: no nsec session key and signer NIP-04 decrypt is unavailable.</p> : null}
        {!canSend ? <p className="text-xs text-amber-300 mt-1">Cannot send: signer does not expose NIP-04 encrypt, and no nsec session key is present.</p> : null}
      </section>

      {loadError ? <div className="cy-card p-3 text-sm text-red-200 border border-red-400/50">{loadError}</div> : null}

      <section className="grid lg:grid-cols-[320px,1fr] gap-4">
        <aside className="cy-card p-3 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-cyan-200">Conversations</h2>
            <p className="text-xs text-cyan-400/80">{conversations.length} thread{conversations.length === 1 ? '' : 's'}</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-cyan-300">Start/open thread by pubkey</label>
            <input
              value={manualPubkey}
              onChange={(event) => setManualPubkey(event.target.value)}
              placeholder="64-char hex pubkey"
              className="w-full rounded-md bg-slate-950/80 border border-cyan-500/30 px-3 py-2 text-sm"
            />
            <button type="button" className="cy-chip" onClick={onStartConversation}>Open thread</button>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {loading ? <p className="text-sm text-cyan-300">Loading conversations…</p> : null}
            {!loading && conversations.length === 0 ? <p className="text-sm text-cyan-300/70">No DMs yet.</p> : null}
            {conversations.map((conversation) => {
              const profile = profiles.get(conversation.counterpartyPubkey);
              const title = profileDisplayName(conversation.counterpartyPubkey, profile);
              const active = conversation.counterpartyPubkey === selectedPubkey;
              return (
                <button
                  key={conversation.counterpartyPubkey}
                  type="button"
                  onClick={() => onSelectConversation(conversation.counterpartyPubkey)}
                  className={`w-full text-left rounded-lg border px-3 py-2 ${active ? 'border-cyan-300 bg-cyan-500/10' : 'border-cyan-500/20 bg-slate-950/40 hover:bg-cyan-500/5'}`}
                >
                  <p className="text-sm font-medium text-cyan-100">{title}</p>
                  <p className="text-xs text-cyan-400">{truncateNpub(conversation.counterpartyPubkey)}</p>
                  <p className="text-xs text-cyan-300/80 mt-1">{conversation.lastMessagePreview || 'Encrypted message'}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="cy-card p-4 min-h-[420px] flex flex-col">
          {!selectedPubkey ? (
            <div className="flex-1 grid place-items-center text-cyan-300/80 text-sm">Pick or open a conversation to view the thread.</div>
          ) : (
            <>
              <header className="border-b border-cyan-500/25 pb-3 mb-3">
                <p className="text-sm text-cyan-400">Thread with</p>
                <p className="font-semibold text-cyan-100">{profileDisplayName(selectedPubkey, profiles.get(selectedPubkey))}</p>
                <p className="text-xs text-cyan-400">{truncateNpub(selectedPubkey)}</p>
              </header>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {(selectedConversation?.messages || []).length === 0 ? (
                  <div className="text-sm text-cyan-300/80">No messages in this thread yet.</div>
                ) : (
                  (selectedConversation?.messages || []).map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-lg px-3 py-2 border text-sm ${message.outgoing ? 'ml-auto max-w-[80%] border-cyan-300/60 bg-cyan-500/10 text-cyan-50' : 'mr-auto max-w-[80%] border-cyan-500/30 bg-slate-950/40 text-cyan-100'}`}
                    >
                      <p>{message.plaintext || '🔒 Encrypted message (unable to decrypt in current session)'}</p>
                      {message.decryptionError ? <p className="mt-1 text-[11px] text-amber-300">Decrypt error: {message.decryptionError}</p> : null}
                      <p className="mt-1 text-[11px] text-cyan-400">{new Date(message.createdAt * 1000).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>

              <footer className="pt-3 mt-3 border-t border-cyan-500/25 space-y-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={canSend ? 'Write a private message…' : 'Cannot send in this session (missing NIP-04 encrypt capability)'}
                  className="w-full rounded-lg bg-slate-950/80 border border-cyan-500/30 px-3 py-2 min-h-[88px] text-sm"
                  disabled={!canSend || sendState === 'sending'}
                />
                {sendError ? <p className="text-xs text-red-300">{sendError}</p> : null}
                {sendState === 'sent' ? <p className="text-xs text-emerald-300">Message sent.</p> : null}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onSend}
                    className="cy-btn"
                    disabled={!canSend || sendState === 'sending' || !draft.trim()}
                  >
                    {sendState === 'sending' ? 'Sending…' : 'Send DM'}
                  </button>
                </div>
              </footer>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
