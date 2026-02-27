import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { PaymentModal } from '../payments/PaymentModal';
import type { TierInfo, SubscriptionTier, BillingCycle } from '../../types';

const TIER_ORDER: SubscriptionTier[] = ['FREE', 'PRO', 'BUSINESS', 'LIFETIME'];
const ANNUAL_MULTIPLIER = 10; // 12 months - 2 months free
const ANNUAL_MONTHS_FREE = 2;

const FALLBACK_TIERS: TierInfo[] = [
  {
    tier: 'FREE',
    name: 'Free',
    description: 'Use the social app for free. Upgrade only when you want a managed NIP-05.',
    priceUsd: 0,
    priceSats: 0,
    features: ['Feed + discovery', 'Post, reply, repost', 'Community support'],
    nip05Limit: 0,
    customDomain: false,
    analytics: false,
    apiAccess: false,
    blossomPolicy: 'external-default',
    blossomStorageMb: 0,
  },
  {
    tier: 'PRO',
    name: 'NIP-05 Pro',
    description: 'Single-user NIP-05 + Lightning address on your timeline.',
    priceUsd: 500,
    priceSats: 17000,
    features: ['1 managed NIP-05 identity', '1 managed Lightning address', 'Fast activation + support'],
    nip05Limit: 1,
    customDomain: false,
    analytics: false,
    apiAccess: false,
    blossomPolicy: 'managed-paid',
    blossomStorageMb: 1024,
  },
  {
    tier: 'BUSINESS',
    name: 'Business',
    description: 'Hidden from checkout (legacy tier).',
    priceUsd: 2900,
    priceSats: 95000,
    features: ['Legacy tier'],
    nip05Limit: 100,
    customDomain: true,
    analytics: true,
    apiAccess: true,
    blossomPolicy: 'managed-paid',
    blossomStorageMb: 5120,
  },
  {
    tier: 'LIFETIME',
    name: 'NIP-05 Lifetime',
    description: 'One payment. Keep your NIP-05 + Lightning identity active permanently.',
    priceUsd: 4900,
    priceSats: 165000,
    features: ['Single-user identity forever', 'No monthly renewals', 'Priority migration support'],
    nip05Limit: 1,
    customDomain: false,
    analytics: false,
    apiAccess: false,
    blossomPolicy: 'managed-paid',
    blossomStorageMb: 1024,
    isLifetime: true,
  },
];

export function PricingPage() {
  const { user } = useAuth();
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [selectedBilling, setSelectedBilling] = useState<BillingCycle>('monthly');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  useEffect(() => {
    api.getTiers()
      .then((data) => {
        const source = data?.length ? data : FALLBACK_TIERS;
        const sorted = [...source].sort(
          (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)
        );
        setTiers(sorted);
      })
      .catch(() => {
        setTiers(FALLBACK_TIERS);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSelectTier = (tier: SubscriptionTier, cycle: BillingCycle = billingCycle) => {
    if (tier === 'FREE' || tier === 'BUSINESS') return;
    const resolvedTier = cycle === 'lifetime' ? 'LIFETIME' : tier;
    setSelectedTier(resolvedTier);
    setSelectedBilling(cycle);
    setShowPaymentModal(true);
  };

  const formatPrice = (tier: TierInfo, cycle: BillingCycle) => {
    if (tier.priceUsd === 0) return 'Free';
    if (cycle === 'lifetime' || tier.isLifetime) {
      const usd = (tier.priceUsd / 100).toFixed(0);
      return `$${usd}`;
    }
    if (cycle === 'annual') {
      const usd = ((tier.priceUsd / 100) * ANNUAL_MULTIPLIER).toFixed(0);
      return `$${usd}/yr`;
    }
    const usd = (tier.priceUsd / 100).toFixed(0);
    return `$${usd}/mo`;
  };

  const formatSats = (sats: number, cycle: BillingCycle) => {
    if (sats <= 0) return '';
    const base = cycle === 'annual' ? sats * ANNUAL_MULTIPLIER : sats;
    if (base >= 1000) {
      return `${(base / 1000).toFixed(0)}k sats`;
    }
    return `${base} sats`;
  };

  const visibleTiers = tiers.filter((tier) => {
    if (tier.tier === 'BUSINESS') return false;
    if (billingCycle === 'lifetime') return tier.tier === 'LIFETIME' || tier.tier === 'FREE';
    if (billingCycle === 'annual' || billingCycle === 'monthly') return tier.tier === 'FREE' || tier.tier === 'PRO';
    return false;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-nostr-purple border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-nostr-purple/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-nostr-purple">
          Your Nostr Identity
        </div>
        <h1 className="text-4xl font-bold text-white mt-4 mb-4">Simple NIP-05 pricing for individuals</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Pick your registration length: monthly, annual, or lifetime. No team bundles, no enterprise upsells—just
          one verified Nostr identity that works everywhere.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-4 mb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { step: '01', label: 'Choose length' },
            { step: '02', label: 'Connect Nostr' },
            { step: '03', label: 'Pay Lightning' },
            { step: '04', label: 'Use NIP-05 now' },
          ].map((item) => (
            <div key={item.step} className="bg-nostr-dark rounded-lg p-4 border border-gray-800">
              <p className="text-xs text-gray-500">{item.step}</p>
              <p className="text-sm font-semibold text-white mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center mb-10 px-4">
        <div className="inline-flex rounded-full bg-nostr-dark p-1 border border-gray-800">
          {(['monthly', 'annual', 'lifetime'] as BillingCycle[]).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              className={`px-5 py-2 text-sm font-semibold rounded-full transition-all ${
                billingCycle === cycle
                  ? 'bg-nostr-purple text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {cycle === 'monthly' && 'Monthly'}
              {cycle === 'annual' && `Annual (save ${ANNUAL_MONTHS_FREE} months)`}
              {cycle === 'lifetime' && 'Lifetime'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto px-4">
        {visibleTiers.map((tier) => {
          const isCurrentTier = user?.tier === tier.tier;
          const isPopular = tier.tier === 'PRO' && billingCycle !== 'lifetime';

          return (
            <div
              key={tier.tier}
              className={`relative bg-nostr-dark rounded-xl p-6 border transition-all ${
                isPopular
                  ? 'border-nostr-purple scale-[1.02] shadow-lg shadow-nostr-purple/20'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-nostr-purple text-white text-xs font-bold px-3 py-1 rounded-full">
                  Best Value
                </div>
              )}

              {(tier.isLifetime || billingCycle === 'lifetime') && tier.tier !== 'FREE' && (
                <div className="absolute -top-3 right-4 bg-nostr-orange text-white text-xs font-bold px-3 py-1 rounded-full">
                  One-Time
                </div>
              )}

              <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
              <p className="text-gray-400 text-sm mb-4">{tier.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-white">{formatPrice(tier, billingCycle)}</span>
                {tier.priceSats > 0 && (
                  <span className="text-gray-400 text-sm ml-2">≈ {formatSats(tier.priceSats, billingCycle)}</span>
                )}
                {billingCycle === 'annual' && tier.priceUsd > 0 && (
                  <div className="text-xs text-green-400 mt-2">2 months free included</div>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <svg
                      className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectTier(tier.tier)}
                disabled={isCurrentTier || tier.tier === 'FREE'}
                className={`w-full py-3 rounded-lg font-semibold transition-all ${
                  isCurrentTier
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : tier.tier === 'FREE'
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : isPopular
                    ? 'bg-nostr-purple hover:bg-nostr-purple/80 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                {isCurrentTier
                  ? 'Current Plan'
                  : tier.tier === 'FREE'
                  ? 'Start Free'
                  : billingCycle === 'annual'
                  ? `Start ${tier.name} Annual`
                  : billingCycle === 'lifetime'
                  ? `Get ${tier.name}`
                  : `Start ${tier.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-12 max-w-3xl mx-auto px-4">
        <div className="bg-nostr-dark rounded-xl border border-gray-800 p-6">
          <h2 className="text-xl font-bold text-white mb-3">Competitive benchmark</h2>
          <p className="text-sm text-gray-300 mb-3">
            Public NIP-05 providers commonly price in the ~6,875 to 12,500 sat range for standard names (length-based)
            and around 9,000 sats/year for budget annual options. NostrMaxi keeps monthly and annual individual pricing
            close to market while adding managed Lightning and instant activation.
          </p>
          <p className="text-xs text-gray-500">
            Sources reviewed: nip-05.com, nostrplebs.com, nostrich.house (accessed 2026-02-26).
          </p>
        </div>
      </div>

      <div className="mt-16 max-w-3xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div className="bg-nostr-dark rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">What is NIP-05?</h3>
            <p className="text-gray-400 text-sm">
              NIP-05 verifies your Nostr identity with a domain name (like an email address). It makes your profile
              easier to find and proves that your identity is real.
            </p>
          </div>
          <div className="bg-nostr-dark rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">How do I pay?</h3>
            <p className="text-gray-400 text-sm">
              Lightning only. Scan the invoice, pay, and your NIP-05 is active right away.
            </p>
          </div>
          <div className="bg-nostr-dark rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">Can I register for longer than one month?</h3>
            <p className="text-gray-400 text-sm">
              Yes—choose monthly, annual, or lifetime at checkout.
            </p>
          </div>
        </div>
      </div>

      {showPaymentModal && selectedTier && (
        <PaymentModal
          tier={selectedTier}
          billingCycle={selectedBilling}
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedTier(null);
          }}
        />
      )}
    </div>
  );
}
