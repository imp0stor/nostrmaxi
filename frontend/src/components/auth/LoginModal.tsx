import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getSignerChoices, type NostrProviderId, type NostrProviderOption } from '../../lib/nostr';
import { LnurlQrCode } from './LnurlQrCode';
import { QRCodeConnect } from './QRCodeConnect';
import { useNostrConnect } from '../../hooks/useNostrConnect';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type LoginMethod = 'extension' | 'lnurl' | 'nsec' | 'nostr_connect';

const LAST_SIGNER_STORAGE_KEY = 'nostrmaxi_last_signer';

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const {
    loginWithExtension,
    loginWithNsec,
    loginWithLnurl,
    pollLnurlLogin,
    isLoading,
    error,
    clearError,
    isAuthenticated,
    signerDebugMarker,
  } = useAuth();
  const { status: nostrConnectStatus, error: nostrConnectError, connectionUri, start: startNostrConnect, cancel: cancelNostrConnect, reset: resetNostrConnect } = useNostrConnect();
  const [method, setMethod] = useState<LoginMethod | null>(null);
  const [lnurlData, setLnurlData] = useState<{ lnurl: string; k1: string } | null>(null);
  const [providers, setProviders] = useState<NostrProviderOption[]>([]);
  const [activeProvider, setActiveProvider] = useState<NostrProviderId | null>(null);
  const [nsecInput, setNsecInput] = useState('');

  const availableProviders = providers.filter((provider) => provider.isAvailable);
  const hasExtension = availableProviders.length > 0;
  const multipleSigners = availableProviders.length > 1;

  useEffect(() => {
    if (!isOpen) return;

    const savedSigner = typeof window !== 'undefined'
      ? (localStorage.getItem(LAST_SIGNER_STORAGE_KEY) as NostrProviderId | null)
      : null;

    let mounted = true;

    const checkProviders = async () => {
      for (let i = 0; i < 10; i += 1) {
        if (!mounted) return;

        const detected = getSignerChoices();
        setProviders(detected);

        const available = detected.filter((provider) => provider.isAvailable);
        if (available.length > 0) {
          const chosen = (savedSigner && available.some((p) => p.id === savedSigner))
            ? savedSigner
            : available[0].id;
          setActiveProvider(chosen);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      setActiveProvider(null);
    };

    void checkProviders();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isAuthenticated) {
      cancelNostrConnect();
      onClose();
    }
  }, [isAuthenticated, onClose, cancelNostrConnect]);

  useEffect(() => {
    if (!lnurlData) return;

    const interval = setInterval(async () => {
      const done = await pollLnurlLogin(lnurlData.k1);
      if (done) {
        clearInterval(interval);
        setLnurlData(null);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [lnurlData, pollLnurlLogin]);

  const handleExtensionLogin = useCallback(async (provider: NostrProviderId) => {
    setActiveProvider(provider);
    setMethod('extension');
    clearError();
    await loginWithExtension(provider);
  }, [loginWithExtension, clearError]);

  const handleLnurlLogin = useCallback(async () => {
    setMethod('lnurl');
    clearError();
    const data = await loginWithLnurl();
    setLnurlData(data);
  }, [loginWithLnurl, clearError]);

  const handleNsecLogin = useCallback(async () => {
    setMethod('nsec');
    clearError();
    await loginWithNsec(nsecInput);
  }, [loginWithNsec, nsecInput, clearError]);

  const handleNostrConnectLogin = useCallback(async () => {
    setMethod('nostr_connect');
    clearError();
    resetNostrConnect();
    await startNostrConnect();
  }, [clearError, resetNostrConnect, startNostrConnect]);

  const handleBack = useCallback(() => {
    setMethod(null);
    setLnurlData(null);
    setNsecInput('');
    cancelNostrConnect();
    clearError();
  }, [cancelNostrConnect, clearError]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-nostr-dark rounded-xl max-w-md w-full p-6 relative">
        <button onClick={() => { cancelNostrConnect(); onClose(); }} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Login with Nostr</h2>
          <p className="text-gray-400">Authenticate using signer app (NIP-46), extension, LNURL, or nsec fallback</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">{error}</div>
        )}

        {!method && (
          <div className="space-y-3">
            <button
              onClick={() => void handleNostrConnectLogin()}
              disabled={isLoading}
              className="w-full p-4 rounded-lg border border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-white">Connect with Signer App</div>
                <div className="text-sm text-gray-400">Best for mobile (Amber, Alby, etc.)</div>
              </div>
            </button>

            {multipleSigners && (
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200">
                Multiple Nostr signers detected. Choose one explicit signer button below.
              </div>
            )}

            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => void handleExtensionLogin(provider.id)}
                disabled={isLoading || !provider.isAvailable}
                className={`w-full p-4 rounded-lg border border-nostr-purple ${provider.isAvailable ? 'bg-nostr-purple/10 hover:bg-nostr-purple/20' : 'bg-gray-900/60'} transition-all text-left`}
              >
                <div className="font-semibold text-white">Login with {provider.label}</div>
                <div className="text-xs text-gray-400 mt-1">{provider.source}</div>
                {provider.warning && <div className="text-xs text-yellow-300 mt-1">{provider.warning}</div>}
                {!provider.isAvailable && provider.unavailableReason && (
                  <div className="text-xs text-amber-300 mt-1">{provider.unavailableReason}</div>
                )}
              </button>
            ))}

            {!hasExtension && (
              <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 text-sm text-gray-300">
                No NIP-07 signer detected.
              </div>
            )}

            <button
              onClick={handleLnurlLogin}
              disabled={isLoading}
              className="w-full p-4 rounded-lg border border-nostr-orange bg-nostr-orange/10 hover:bg-nostr-orange/20 transition-all flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-nostr-orange/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-nostr-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-white">Lightning Wallet</div>
                <div className="text-sm text-gray-400">Scan QR with your wallet</div>
              </div>
            </button>

            <button
              onClick={() => {
                setMethod('nsec');
                clearError();
              }}
              disabled={isLoading}
              className="w-full p-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 hover:bg-yellow-500/20 transition-all flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-1.657 1.343-3 3-3h0a3 3 0 013 3v2a3 3 0 01-3 3h-6a3 3 0 01-3-3v-2a3 3 0 013-3h0m3-6v6" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-white">Use nsec (fallback)</div>
                <div className="text-sm text-gray-400">Only if extension login fails</div>
              </div>
            </button>
          </div>
        )}

        {method === 'lnurl' && lnurlData && (
          <div className="text-center">
            <LnurlQrCode lnurl={lnurlData.lnurl} />
            <p className="mt-4 text-gray-400 text-sm">Scan with your Lightning wallet to login</p>
            <button onClick={handleBack} className="mt-4 text-nostr-purple hover:underline text-sm">← Back to login options</button>
          </div>
        )}

        {method === 'nostr_connect' && connectionUri && (
          <QRCodeConnect
            uri={connectionUri}
            status={nostrConnectStatus}
            error={nostrConnectError}
            onBack={handleBack}
          />
        )}

        {method === 'nsec' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
              Security warning: your nsec is your private key. Never paste it on shared/public machines and rotate keys if you suspect exposure.
            </div>
            <p className="text-sm text-yellow-300/80">Fallback login only: paste your nsec or 64-char hex private key.</p>
            <textarea value={nsecInput} onChange={(e) => setNsecInput(e.target.value)} placeholder="nsec1..." rows={3} className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm" />
            <div className="flex gap-3">
              <button onClick={handleNsecLogin} disabled={isLoading || !nsecInput.trim()} className="flex-1 rounded-lg bg-yellow-500/80 hover:bg-yellow-500 text-black font-medium py-2 disabled:opacity-50">Continue with nsec</button>
              <button onClick={handleBack} disabled={isLoading} className="rounded-lg border border-gray-600 text-gray-300 px-4 py-2">Back</button>
            </div>
          </div>
        )}

        {isLoading && (method === 'extension' || method === 'nsec') && (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-nostr-purple border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">
              {method === 'extension'
                ? `Check ${providers.find((p) => p.id === activeProvider)?.label ?? 'your selected signer'} for the signing prompt...`
                : 'Signing authentication challenge...'}
            </p>
            {signerDebugMarker && (
              <div className="text-[10px] text-gray-500 mt-2">debug: {signerDebugMarker}</div>
            )}
            <button onClick={handleBack} className="mt-4 text-nostr-purple hover:underline text-sm">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
