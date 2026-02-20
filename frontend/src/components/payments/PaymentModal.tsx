import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { InvoiceQrCode } from './InvoiceQrCode';
import type { SubscriptionTier, PaymentInvoice } from '../../types';

interface PaymentModalProps {
  tier: SubscriptionTier;
  billingCycle?: 'monthly' | 'annual' | 'lifetime';
  isOpen: boolean;
  onClose: () => void;
}

type PaymentState = 'creating' | 'pending' | 'paid' | 'expired' | 'error';

export function PaymentModal({ tier, billingCycle = 'monthly', isOpen, onClose }: PaymentModalProps) {
  const { refreshUser, isAuthenticated } = useAuth();
  const [state, setState] = useState<PaymentState>('creating');
  const [invoice, setInvoice] = useState<PaymentInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTier, setNewTier] = useState<string | null>(null);

  // Create invoice on mount
  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;

    setState('creating');
    setError(null);

    api.createInvoice(tier, true, billingCycle)
      .then((inv) => {
        setInvoice(inv);
        setState('pending');
      })
      .catch((err) => {
        setError(err.message || 'Failed to create invoice');
        setState('error');
      });
  }, [isOpen, tier, billingCycle, isAuthenticated]);

  // Poll for payment status
  useEffect(() => {
    if (state !== 'pending' || !invoice) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await api.checkInvoice(invoice.paymentId);
        
        if (status.paid) {
          setState('paid');
          setNewTier(status.tier || tier);
          refreshUser();
          clearInterval(pollInterval);
        } else if (status.status === 'expired') {
          setState('expired');
          clearInterval(pollInterval);
        }
      } catch {
        // Ignore poll errors
      }
    }, 2000);

    // Also check expiry client-side
    const expiryTimeout = setTimeout(() => {
      if (state === 'pending') {
        setState('expired');
      }
    }, (invoice.expiresAt - Math.floor(Date.now() / 1000)) * 1000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(expiryTimeout);
    };
  }, [state, invoice, tier, refreshUser]);

  const handleRetry = useCallback(() => {
    setState('creating');
    setError(null);
    setInvoice(null);

    api.createInvoice(tier, true, billingCycle)
      .then((inv) => {
        setInvoice(inv);
        setState('pending');
      })
      .catch((err) => {
        setError(err.message || 'Failed to create invoice');
        setState('error');
      });
  }, [tier, billingCycle]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-nostr-dark rounded-xl max-w-md w-full p-6 relative">
        {/* Close button - only show if not processing payment */}
        {(state === 'paid' || state === 'error' || state === 'expired') && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Creating invoice */}
        {state === 'creating' && (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-nostr-orange border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white font-semibold">Creating Invoice...</p>
            <p className="text-gray-400 text-sm mt-2">Preparing your Lightning invoice</p>
          </div>
        )}

        {/* Pending payment */}
        {state === 'pending' && invoice && (
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-2">
              Pay with Lightning
            </h2>
            <p className="text-sm text-gray-400 mb-3">
              {billingCycle === 'annual'
                ? 'Annual billing (2 months free)'
                : billingCycle === 'lifetime'
                ? 'Lifetime access'
                : 'Monthly billing'}
            </p>
            
            {/* Amount display */}
            <div className="mb-4">
              <span className="text-3xl font-bold text-nostr-orange">
                {invoice.amountSats.toLocaleString()}
              </span>
              <span className="text-gray-400 ml-2">sats</span>
              
              {invoice.discountPercent > 0 && (
                <div className="text-green-400 text-sm mt-1">
                  🎉 {invoice.discountPercent}% WoT discount applied!
                </div>
              )}
            </div>

            {/* QR Code */}
            <InvoiceQrCode invoice={invoice.invoice} />

            {/* Timer */}
            <InvoiceTimer expiresAt={invoice.expiresAt} />

            {/* Status indicator */}
            <div className="mt-4 flex items-center justify-center gap-2 text-gray-400">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Waiting for payment...</span>
            </div>

            {/* Cancel button */}
            <button
              onClick={onClose}
              className="mt-4 text-gray-400 hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Payment success */}
        {state === 'paid' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
            <p className="text-gray-400 mb-4">
              Welcome to {newTier}! Your subscription is now active.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-nostr-purple hover:bg-nostr-purple/80 text-white font-semibold rounded-lg transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {/* Payment expired */}
        {state === 'expired' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Invoice Expired</h2>
            <p className="text-gray-400 mb-4">
              The payment window has closed. Please try again.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleRetry}
                className="px-6 py-3 bg-nostr-purple hover:bg-nostr-purple/80 text-white font-semibold rounded-lg transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Error</h2>
            <p className="text-gray-400 mb-4">{error || 'Something went wrong'}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleRetry}
                className="px-6 py-3 bg-nostr-purple hover:bg-nostr-purple/80 text-white font-semibold rounded-lg transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Invoice countdown timer
function InvoiceTimer({ expiresAt }: { expiresAt: number }) {
  const [timeLeft, setTimeLeft] = useState(expiresAt - Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = expiresAt - Math.floor(Date.now() / 1000);
      setTimeLeft(Math.max(0, remaining));
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="mt-3 text-gray-400 text-sm">
      Expires in{' '}
      <span className={timeLeft < 60 ? 'text-red-400 font-semibold' : ''}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}
