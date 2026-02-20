import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { PaymentModal } from '../payments/PaymentModal';
import type { Subscription, SubscriptionTier } from '../../types';

export function SubscriptionManager() {
  const { refreshUser, isAuthenticated } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch subscription data
  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    api.getSubscription()
      .then(setSubscription)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.')) {
      return;
    }

    setActionLoading(true);
    try {
      await api.cancelSubscription();
      const updated = await api.getSubscription();
      setSubscription(updated);
      refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      await api.reactivateSubscription();
      const updated = await api.getSubscription();
      setSubscription(updated);
      refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpgrade = (tier: SubscriptionTier) => {
    setSelectedTier(tier);
    setShowUpgradeModal(true);
  };

  const handleUpgradeComplete = async () => {
    setShowUpgradeModal(false);
    setSelectedTier(null);
    // Refresh subscription data
    const updated = await api.getSubscription();
    setSubscription(updated);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-nostr-purple border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || !subscription) {
    return (
      <div className="bg-nostr-dark rounded-xl p-6 text-center">
        <p className="text-gray-400">Please login to manage your subscription.</p>
      </div>
    );
  }

  const { tier, tierInfo, isActive, isCancelled, expiresAt, daysRemaining, wotDiscount, nip05Count, nip05Limit, recentPayments } = subscription;

  return (
    <div className="space-y-6">
      {/* Error display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Current Plan Card */}
      <div className="bg-nostr-dark rounded-xl p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Current Plan</h2>
            <p className="text-gray-400 text-sm">Manage your subscription</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Plan details */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-nostr-purple/20 rounded-lg flex items-center justify-center">
                <span className="text-2xl">{tierInfo.tier === 'FREE' ? '🆓' : tierInfo.tier === 'LIFETIME' ? '∞' : '⚡'}</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">{tierInfo.name}</h3>
                {tier !== 'FREE' && (
                  <p className="text-gray-400 text-sm">
                    {tierInfo.isLifetime ? 'Lifetime access' : `$${(tierInfo.priceUsd / 100).toFixed(0)}/month`}
                  </p>
                )}
              </div>
            </div>

            {/* Expiry info */}
            {tier !== 'FREE' && expiresAt && (
              <div className={`p-3 rounded-lg ${isCancelled ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-gray-800'}`}>
                {isCancelled ? (
                  <>
                    <p className="text-yellow-400 font-medium">Cancelled</p>
                    <p className="text-gray-400 text-sm">Access until {new Date(expiresAt).toLocaleDateString()}</p>
                  </>
                ) : daysRemaining !== null && (
                  <>
                    <p className="text-gray-400 text-sm">Renews in</p>
                    <p className="text-white font-semibold">{daysRemaining} days</p>
                  </>
                )}
              </div>
            )}

            {/* WoT Discount */}
            {wotDiscount > 0 && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 font-medium flex items-center gap-2">
                  <span>🎉</span> {wotDiscount}% WoT Discount
                </p>
                <p className="text-gray-400 text-sm">Your trusted reputation saves you money!</p>
              </div>
            )}
          </div>

          {/* Usage */}
          <div>
            <h4 className="text-white font-semibold mb-3">Usage</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">NIP-05 Identities</span>
                  <span className="text-white">{nip05Count} / {nip05Limit}</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-nostr-purple rounded-full"
                    style={{ width: `${(nip05Count / Math.max(nip05Limit, 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="mt-4">
              <h4 className="text-white font-semibold mb-2">Features</h4>
              <div className="space-y-1">
                {tierInfo.features.slice(0, 4).map((feature, i) => (
                  <p key={i} className="text-gray-400 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          {tier === 'FREE' && (
            <button
              onClick={() => handleUpgrade('PRO')}
              className="px-4 py-2 bg-nostr-purple hover:bg-nostr-purple/80 text-white font-semibold rounded-lg transition-colors"
            >
              Upgrade to Pro
            </button>
          )}
          
          {tier === 'PRO' && (
            <button
              onClick={() => handleUpgrade('BUSINESS')}
              className="px-4 py-2 bg-nostr-purple hover:bg-nostr-purple/80 text-white font-semibold rounded-lg transition-colors"
            >
              Upgrade to Business
            </button>
          )}

          {tier !== 'FREE' && !isCancelled && !tierInfo.isLifetime && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading ? 'Processing...' : 'Cancel Subscription'}
            </button>
          )}

          {isCancelled && (
            <button
              onClick={handleReactivate}
              disabled={actionLoading}
              className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading ? 'Processing...' : 'Reactivate'}
            </button>
          )}
        </div>
      </div>

      {/* Payment History */}
      {recentPayments.length > 0 && (
        <div className="bg-nostr-dark rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Payment History</h2>
          <div className="space-y-3">
            {recentPayments.map((payment) => (
              <div key={payment.id} className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
                <div>
                  <p className="text-white font-medium">
                    {payment.amountSats?.toLocaleString()} sats
                  </p>
                  <p className="text-gray-400 text-sm">
                    {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : '-'}
                  </p>
                </div>
                {payment.receiptNumber && (
                  <button
                    onClick={() => window.open(`/receipt/${payment.id}`, '_blank')}
                    className="text-nostr-purple hover:underline text-sm"
                  >
                    View Receipt
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && selectedTier && (
        <PaymentModal
          tier={selectedTier}
          isOpen={showUpgradeModal}
          onClose={handleUpgradeComplete}
        />
      )}
    </div>
  );
}
