import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { hasNip07Extension } from '../../lib/nostr';
import { LnurlQrCode } from './LnurlQrCode';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type LoginMethod = 'extension' | 'lnurl' | 'nsec';

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { loginWithExtension, loginWithNsec, loginWithLnurl, pollLnurlLogin, isLoading, error, clearError, isAuthenticated } = useAuth();
  const [method, setMethod] = useState<LoginMethod | null>(null);
  const [lnurlData, setLnurlData] = useState<{ lnurl: string; k1: string } | null>(null);
  const [hasExtension, setHasExtension] = useState(false);
  const [nsecInput, setNsecInput] = useState('');

  // Check for extension on open with short retry to avoid injection race
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const checkExtension = async () => {
      for (let i = 0; i < 10; i += 1) {
        if (!mounted) return;
        const detected = hasNip07Extension();
        setHasExtension(detected);
        if (detected) return;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    };

    void checkExtension();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // Close modal when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      onClose();
    }
  }, [isAuthenticated, onClose]);

  // Poll for LNURL auth
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

  const handleExtensionLogin = useCallback(async () => {
    setMethod('extension');
    clearError();
    await loginWithExtension();
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

  const handleBack = useCallback(() => {
    setMethod(null);
    setLnurlData(null);
    setNsecInput('');
    clearError();
  }, [clearError]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-nostr-dark rounded-xl max-w-md w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Login with Nostr</h2>
          <p className="text-gray-400">Authenticate with your npub using NIP-07 or LNURL</p>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Login options */}
        {!method && (
          <div className="space-y-3">
            {/* NIP-07 Extension */}
            <button
              onClick={handleExtensionLogin}
              disabled={!hasExtension || isLoading}
              className={`w-full p-4 rounded-lg border transition-all flex items-center gap-4 ${
                hasExtension
                  ? 'border-nostr-purple bg-nostr-purple/10 hover:bg-nostr-purple/20'
                  : 'border-gray-700 bg-gray-800/50 cursor-not-allowed'
              }`}
            >
              <div className="w-12 h-12 bg-nostr-purple/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-nostr-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-white">Browser Extension</div>
                <div className="text-sm text-gray-400">
                  {hasExtension ? 'Sign with nos2x, Alby, etc.' : 'No extension detected'}
                </div>
              </div>
              {hasExtension && (
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                  Recommended
                </span>
              )}
            </button>

            {/* Lightning Login */}
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

            {/* nsec fallback */}
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

        {/* LNURL QR Code */}
        {method === 'lnurl' && lnurlData && (
          <div className="text-center">
            <LnurlQrCode lnurl={lnurlData.lnurl} />
            <p className="mt-4 text-gray-400 text-sm">
              Scan with your Lightning wallet to login
            </p>
            <button
              onClick={handleBack}
              className="mt-4 text-nostr-purple hover:underline text-sm"
            >
              ← Back to login options
            </button>
          </div>
        )}

        {/* nsec fallback form */}
        {method === 'nsec' && (
          <div className="space-y-4">
            <p className="text-sm text-yellow-300/80">
              Fallback login: paste your nsec or 64-char hex private key.
            </p>
            <textarea
              value={nsecInput}
              onChange={(e) => setNsecInput(e.target.value)}
              placeholder="nsec1..."
              rows={3}
              className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-white text-sm"
            />
            <div className="flex gap-3">
              <button
                onClick={handleNsecLogin}
                disabled={isLoading || !nsecInput.trim()}
                className="flex-1 rounded-lg bg-yellow-500/80 hover:bg-yellow-500 text-black font-medium py-2 disabled:opacity-50"
              >
                Continue with nsec
              </button>
              <button
                onClick={handleBack}
                disabled={isLoading}
                className="rounded-lg border border-gray-600 text-gray-300 px-4 py-2"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (method === 'extension' || method === 'nsec') && (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-nostr-purple border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">
              {method === 'extension' ? 'Check your extension for the signing prompt...' : 'Signing authentication challenge...'}
            </p>
            <button
              onClick={handleBack}
              className="mt-4 text-nostr-purple hover:underline text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
