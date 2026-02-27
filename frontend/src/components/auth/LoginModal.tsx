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
type MobileLoginOption = '' | 'nostr_connect' | 'alby' | 'nos2x' | 'nostrcast' | 'window_nostr' | 'lnurl' | 'nsec';

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
  const [mobileMethod, setMobileMethod] = useState<MobileLoginOption>('');
  const [lnurlData, setLnurlData] = useState<{ lnurl: string; k1: string } | null>(null);
  const [providers, setProviders] = useState<NostrProviderOption[]>([]);
  const [activeProvider, setActiveProvider] = useState<NostrProviderId | null>(null);
  const [nsecInput, setNsecInput] = useState('');

  const availableProviders = providers.filter((provider) => provider.isAvailable);
  const hasExtension = availableProviders.length > 0;
  const multipleSigners = availableProviders.length > 1;

  const providerLabel = {
    alby: 'Alby Extension',
    nos2x: 'nos2x Extension',
    nostrcast: 'NostrCast Keychain',
    window_nostr: 'Browser NIP-07 Signer',
  } satisfies Record<NostrProviderId, string>;

  const isProviderAvailable = useCallback(
    (providerId: NostrProviderId) => providers.some((provider) => provider.id === providerId && provider.isAvailable),
    [providers]
  );

  useEffect(() => {
    if (!isOpen) return;

    setMobileMethod('');

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
    setMobileMethod('');
    setLnurlData(null);
    setNsecInput('');
    cancelNostrConnect();
    clearError();
  }, [cancelNostrConnect, clearError]);

  const handleMobileMethodChange = useCallback((value: MobileLoginOption) => {
    setMobileMethod(value);

    if (value === 'nostr_connect') {
      void handleNostrConnectLogin();
      return;
    }

    if (value === 'lnurl') {
      void handleLnurlLogin();
      return;
    }

    if (value === 'nsec') {
      setMethod('nsec');
      clearError();
      return;
    }

    if (value === 'alby' || value === 'nos2x' || value === 'nostrcast' || value === 'window_nostr') {
      if (isProviderAvailable(value)) {
        void handleExtensionLogin(value);
      }
    }
  }, [clearError, handleExtensionLogin, handleLnurlLogin, handleNostrConnectLogin, isProviderAvailable]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-nostr-dark rounded-xl max-w-md w-full p-4 md:p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={() => { cancelNostrConnect(); onClose(); }} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-4 md:mb-6 pr-8">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Login with Nostr</h2>
          <p className="text-sm md:text-base text-gray-400">Authenticate using signer app (NIP-46), extension, LNURL, or nsec fallback</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">{error}</div>
        )}

        {!method && (
          <>
            {/* Mobile-first: always show dropdown + quick action */}
            <div className="space-y-3">
              <label htmlFor="mobile-login-method" className="block text-sm text-cyan-200">
                Choose login method
              </label>
              <div className="relative">
                <select
                  id="mobile-login-method"
                  value={mobileMethod}
                  onChange={(e) => handleMobileMethodChange(e.target.value as MobileLoginOption)}
                  className="w-full min-h-[48px] rounded-lg border-2 border-cyan-500/50 bg-slate-900 px-4 py-3 pr-10 text-white text-base focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                >
                  <option value="">Select login method...</option>
                  <option value="nostr_connect">📱 Connect with Signer App (Alby, Amber)</option>
                  <option value="alby" disabled={!isProviderAvailable('alby')}>{providerLabel.alby}{!isProviderAvailable('alby') ? ' (not detected)' : ''}</option>
                  <option value="nos2x" disabled={!isProviderAvailable('nos2x')}>{providerLabel.nos2x}{!isProviderAvailable('nos2x') ? ' (not detected)' : ''}</option>
                  <option value="nostrcast" disabled={!isProviderAvailable('nostrcast')}>{providerLabel.nostrcast}{!isProviderAvailable('nostrcast') ? ' (not detected)' : ''}</option>
                  <option value="window_nostr" disabled={!isProviderAvailable('window_nostr')}>{providerLabel.window_nostr}{!isProviderAvailable('window_nostr') ? ' (not detected)' : ''}</option>
                  <option value="lnurl">LNURL Auth</option>
                  <option value="nsec">nsec / Private Key</option>
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-xs text-gray-400 mb-4">Signer extensions not detected on this device are disabled.</p>
              
              {/* Quick action button for mobile */}
              <button
                onClick={() => void handleNostrConnectLogin()}
                disabled={isLoading}
                className="w-full p-4 rounded-lg border-2 border-emerald-500/60 bg-emerald-500/15 hover:bg-emerald-500/25 transition-all flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-white text-base">Open Signer App</div>
                  <div className="text-sm text-emerald-200/80">Alby, Amber, or other NIP-46 signer</div>
                </div>
              </button>
            </div>
          </>
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
