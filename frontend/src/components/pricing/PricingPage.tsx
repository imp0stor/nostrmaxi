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
    description: 'Get started with one verified identity.',
    priceUsd: 0,
    priceSats: 0,
    features: ['1 NIP-05 identity', 'Community support'],
    nip05Limit: 1,
    customDomain: false,
    analytics: false,
    apiAccess: false,
  },
  {
    tier: 'PRO',
    name: 'Pro',
    description: 'For individual creators and serious users.',
    priceUsd: 900,
    priceSats: 30000,
    features: ['10 NIP-05 identities', 'Priority support', 'Usage analytics'],
    nip05Limit: 10,
    customDomain: true,
    analytics: true,
    apiAccess: false,
  },
  {
    tier: 'BUSINESS',
    name: 'Business',
    description: 'For teams and production deployments.',
    priceUsd: 2900,
    priceSats: 95000,
    features: ['100 NIP-05 identities', 'Team workflows', 'API access'],
    nip05Limit: 100,
    customDomain: true,
    analytics: true,
    apiAccess: true,
  },
  {
    tier: 'LIFETIME',
    name: 'Lifetime Pro',
    description: 'One-time payment for permanent Pro access.',
    priceUsd: 19900,
    priceSats: 650000,
    features: ['All Pro features forever', 'No recurring billing'],
    nip05Limit: 10,
    customDomain: true,
    analytics: true,
    apiAccess: false,
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
    if (tier === 'FREE') return;
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
    if (billingCycle === 'lifetime') {
      return tier.tier === 'LIFETIME' || tier.tier === 'FREE';
    }
    return tier.tier !== 'LIFETIME';
  });

  const proTier = tiers.find((tier) => tier.tier === 'PRO');
  const businessTier = tiers.find((tier) => tier.tier === 'BUSINESS');
  const lifetimeTier = tiers.find((tier) => tier.tier === 'LIFETIME');

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
          Enterprise-grade NIP-05 Identity Platform
        </div>
        <h1 className="text-4xl font-bold text-white mt-4 mb-4">
          Pricing that scales from solo to enterprise
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Issue verified Nostr identities, manage domains, and activate analytics in minutes.
          Pay with Lightning for instant activation and zero vendor lock-in.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-4 mb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { step: '01', label: 'Choose plan' },
            { step: '02', label: 'Connect Nostr' },
            { step: '03', label: 'Pay with Lightning' },
            { step: '04', label: 'Go live instantly' },
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

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto px-4">
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
                  Most Popular
                </div>
              )}

              {(tier.isLifetime || billingCycle === 'lifetime') && tier.tier !== 'FREE' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-nostr-orange text-white text-xs font-bold px-3 py-1 rounded-full">
                  One-Time
                </div>
              )}

              <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
              <p className="text-gray-400 text-sm mb-4">{tier.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-white">
                  {formatPrice(tier, billingCycle)}
                </span>
                {tier.priceSats > 0 && (
                  <span className="text-gray-400 text-sm ml-2">
                    ≈ {formatSats(tier.priceSats, billingCycle)}
                  </span>
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

      <div className="mt-16 max-w-5xl mx-auto px-4">
        <div className="bg-nostr-dark rounded-xl border border-gray-800 p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Annual & Lifetime Pricing Matrix</h2>
          <div className="grid grid-cols-4 gap-4 text-sm text-gray-400">
            <div></div>
            <div className="text-white font-semibold">Pro</div>
            <div className="text-white font-semibold">Business</div>
            <div className="text-white font-semibold">Lifetime Pro</div>

            <div className="text-white font-semibold">Monthly</div>
            <div>{proTier ? formatPrice(proTier, 'monthly') : '$9/mo'}</div>
            <div>{businessTier ? formatPrice(businessTier, 'monthly') : '$29/mo'}</div>
            <div>{lifetimeTier ? formatPrice(lifetimeTier, 'lifetime') : '$199 one-time'}</div>

            <div className="text-white font-semibold">Annual</div>
            <div>{proTier ? formatPrice(proTier, 'annual') : '$90/yr'}</div>
            <div>{businessTier ? formatPrice(businessTier, 'annual') : '$290/yr'}</div>
            <div>{lifetimeTier ? formatPrice(lifetimeTier, 'lifetime') : '$199 one-time'}</div>

            <div className="text-white font-semibold">Lifetime</div>
            <div>{lifetimeTier ? formatPrice(lifetimeTier, 'lifetime') : '$199 one-time'}</div>
            <div>{lifetimeTier ? formatPrice(lifetimeTier, 'lifetime') : '$199 one-time'}</div>
            <div>{lifetimeTier ? formatPrice(lifetimeTier, 'lifetime') : '$199 one-time'}</div>
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => handleSelectTier('PRO', 'annual')}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white"
            >
              Choose Pro Annual
            </button>
            <button
              onClick={() => handleSelectTier('BUSINESS', 'annual')}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white"
            >
              Choose Business Annual
            </button>
            <button
              onClick={() => handleSelectTier('LIFETIME', 'lifetime')}
              className="px-4 py-2 rounded-lg bg-nostr-purple hover:bg-nostr-purple/80 text-white"
            >
              Choose Lifetime
            </button>
          </div>
        </div>
      </div>

      <div className="mt-16 max-w-3xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-white text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          <div className="bg-nostr-dark rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">What is NIP-05?</h3>
            <p className="text-gray-400 text-sm">
              NIP-05 verifies your Nostr identity with a domain name (like an email address).
              It makes your profile easier to find and proves you control the identity.
            </p>
          </div>
          <div className="bg-nostr-dark rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">How do I pay?</h3>
            <p className="text-gray-400 text-sm">
              We accept Lightning payments only. Scan the QR code with any Lightning wallet to pay instantly.
              No KYC required, no chargebacks.
            </p>
          </div>
          <div className="bg-nostr-dark rounded-lg p-4">
            <h3 className="font-semibold text-white mb-2">What about enterprise teams?</h3>
            <p className="text-gray-400 text-sm">
              Business plans include multi-identity support, analytics, API access, and priority routing.
              Contact us for volume pricing and onboarding support.
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
