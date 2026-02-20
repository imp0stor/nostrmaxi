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
  const { loginWithExtension, loginWithLnurl, pollLnurlLogin, isLoading, error, clearError, isAuthenticated } = useAuth();
  const [method, setMethod] = useState<LoginMethod | null>(null);
  const [lnurlData, setLnurlData] = useState<{ lnurl: string; k1: string } | null>(null);
  const [hasExtension, setHasExtension] = useState(false);

  // Check for extension on mount
  useEffect(() => {
    setHasExtension(hasNip07Extension());
  }, []);

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

  const handleBack = useCallback(() => {
    setMethod(null);
    setLnurlData(null);
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
          <h2 className="text-2xl font-bold text-white mb-2">Login to NostrMaxi</h2>
          <p className="text-gray-400">Choose your preferred login method</p>
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

            {/* nsec warning */}
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm">
                  <p className="text-yellow-400 font-medium">Security Notice</p>
                  <p className="text-yellow-300/70">
                    We do not support nsec login for your safety. Use a browser extension to keep your keys secure.
                  </p>
                </div>
              </div>
            </div>
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

        {/* Loading state */}
        {isLoading && method === 'extension' && (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-nostr-purple border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Check your extension for the signing prompt...</p>
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
