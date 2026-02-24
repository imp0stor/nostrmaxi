import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SubscriptionTier } from '../../types';

interface PostPaymentWizardProps {
  tier: SubscriptionTier;
  paymentId: string;
  onComplete: () => void;
}

type Step = 'success' | 'claim-identity' | 'configure-client' | 'done';

export function PostPaymentWizard({ tier, paymentId, onComplete }: PostPaymentWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>('success');
  const [identityClaimed] = useState(false);

  const steps: { id: Step; label: string; complete: boolean }[] = [
    { id: 'success', label: 'Payment Confirmed', complete: true },
    { id: 'claim-identity', label: 'Claim Your Identity', complete: identityClaimed },
    { id: 'configure-client', label: 'Configure Nostr Client', complete: false },
    { id: 'done', label: 'All Set!', complete: false },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    } else {
      onComplete();
    }
  };

  const handleClaimLater = () => {
    setCurrentStep('done');
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-nostr-dark rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Progress bar */}
        <div className="sticky top-0 bg-nostr-dark border-b border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    idx <= currentStepIndex
                      ? 'bg-nostr-purple text-white'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {step.complete ? '✓' : idx + 1}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      idx < currentStepIndex ? 'bg-nostr-purple' : 'bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-400 text-center">{steps[currentStepIndex].label}</p>
        </div>

        {/* Step content */}
        <div className="p-8">
          {currentStep === 'success' && (
            <div className="text-center">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-10 h-10 text-green-500"
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
              </div>

              <h2 className="text-3xl font-bold text-white mb-2">Payment Confirmed!</h2>
              <p className="text-xl text-nostr-purple mb-4">
                Welcome to {tier === 'LIFETIME' ? 'Lifetime' : tier} 🎉
              </p>

              <div className="bg-nostr-darker rounded-lg p-6 mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 mb-1">Receipt</p>
                    <Link
                      to={`/receipt/${paymentId}`}
                      className="text-nostr-purple hover:underline font-mono text-xs"
                    >
                      View Receipt →
                    </Link>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Subscription</p>
                    <p className="text-white font-semibold">{tier}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-left mb-6">
                <h3 className="font-semibold text-white mb-3">What's Next:</h3>
                {tier !== 'FREE' && (
                  <div className="flex items-start gap-3 text-sm">
                    <div className="w-6 h-6 bg-nostr-purple/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-nostr-purple">1</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">Claim Your NIP-05 Identity</p>
                      <p className="text-gray-400 text-xs">
                        Get verified with {tier === 'PRO' ? 'up to 3' : tier === 'BUSINESS' ? 'up to 10' : 'unlimited'} identities
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-6 h-6 bg-nostr-purple/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-nostr-purple">2</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">Configure Your Nostr Client</p>
                    <p className="text-gray-400 text-xs">
                      Add your new identity to Damus, Amethyst, Primal, or any client
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-6 h-6 bg-nostr-purple/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-nostr-purple">3</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">Explore Your Dashboard</p>
                    <p className="text-gray-400 text-xs">
                      View analytics, manage identities, and track your Web of Trust score
                    </p>
                  </div>
                </div>
              </div>

              <button onClick={handleNext} className="ui-cta w-full">
                Let's Go! →
              </button>
            </div>
          )}

          {currentStep === 'claim-identity' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Claim Your NIP-05 Identity</h2>
              <p className="text-gray-400 mb-6">
                Your NIP-05 identity makes you easier to find and verifies you control your Nostr profile.
                It works like email: <strong className="text-white">username@domain.com</strong>
              </p>

              <div className="bg-nostr-darker rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">Choose Your Style:</h3>
                <div className="space-y-4">
                  <Link
                    to="/nip05"
                    className="block p-4 bg-nostr-dark hover:bg-nostr-dark/80 rounded-lg border border-gray-700 hover:border-nostr-purple transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-nostr-purple/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">⚡</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-white mb-1">Simple (Recommended)</p>
                        <p className="text-sm text-gray-400">
                          Use <strong className="text-white">yourname@nostrmaxi.com</strong> — instant, hassle-free
                        </p>
                      </div>
                    </div>
                  </Link>

                  {tier !== 'FREE' && (
                    <Link
                      to="/nip05?tab=byod"
                      className="block p-4 bg-nostr-dark hover:bg-nostr-dark/80 rounded-lg border border-gray-700 hover:border-nostr-purple transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-nostr-orange/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl">🌐</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-white mb-1">Custom Domain (Advanced)</p>
                          <p className="text-sm text-gray-400">
                            Use your own domain like <strong className="text-white">you@yourdomain.com</strong>
                          </p>
                          <span className="inline-block mt-2 text-xs bg-nostr-purple/20 text-nostr-purple px-2 py-1 rounded">
                            {tier === 'PRO' ? 'PRO' : 'BUSINESS'} Feature
                          </span>
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleNext} className="ui-cta flex-1">
                  Continue →
                </button>
                <button onClick={handleClaimLater} className="ui-button">
                  I'll Do This Later
                </button>
              </div>
            </div>
          )}

          {currentStep === 'configure-client' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Add to Your Nostr Client</h2>
              <p className="text-gray-400 mb-6">
                Once you've claimed your identity, add it to your profile in any Nostr client.
              </p>

              <div className="space-y-4 mb-6">
                <div className="bg-nostr-darker rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-xl">🍎</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white">Damus (iOS)</p>
                      <p className="text-xs text-gray-400">Most popular iOS client</p>
                    </div>
                  </div>
                  <ol className="text-sm text-gray-300 space-y-2 ml-13">
                    <li>1. Open Damus → Tap your profile</li>
                    <li>2. Tap "Edit Profile"</li>
                    <li>3. Enter your NIP-05 in the "NIP-05" field</li>
                    <li>4. Save — verification happens automatically!</li>
                  </ol>
                </div>

                <div className="bg-nostr-darker rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-xl">🤖</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white">Amethyst (Android)</p>
                      <p className="text-xs text-gray-400">Leading Android client</p>
                    </div>
                  </div>
                  <ol className="text-sm text-gray-300 space-y-2 ml-13">
                    <li>1. Open Amethyst → Profile tab</li>
                    <li>2. Tap the edit icon (pencil)</li>
                    <li>3. Find "NIP-05 Verification" field</li>
                    <li>4. Paste your identity and save</li>
                  </ol>
                </div>

                <div className="bg-nostr-darker rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-xl">🌐</span>
                    </div>
                    <div>
                      <p className="font-semibold text-white">Primal / Other Web Clients</p>
                      <p className="text-xs text-gray-400">Works everywhere</p>
                    </div>
                  </div>
                  <ol className="text-sm text-gray-300 space-y-2 ml-13">
                    <li>1. Navigate to profile settings</li>
                    <li>2. Look for "NIP-05" or "Verification" field</li>
                    <li>3. Enter your identity (e.g., alice@nostrmaxi.com)</li>
                    <li>4. Save and wait ~1 minute for verification ✓</li>
                  </ol>
                </div>
              </div>

              <button onClick={handleNext} className="ui-cta w-full">
                Got It! →
              </button>
            </div>
          )}

          {currentStep === 'done' && (
            <div className="text-center">
              <div className="w-20 h-20 bg-nostr-purple/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🚀</span>
              </div>

              <h2 className="text-3xl font-bold text-white mb-2">You're All Set!</h2>
              <p className="text-gray-400 mb-6">
                Your {tier} subscription is active. Explore your dashboard to manage identities and track analytics.
              </p>

              <div className="bg-gradient-to-br from-nostr-purple/20 to-nostr-orange/20 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Links:</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    to="/dashboard"
                    className="bg-nostr-dark hover:bg-nostr-darker p-3 rounded-lg text-sm text-white transition-colors"
                  >
                    📊 Dashboard
                  </Link>
                  <Link
                    to="/nip05"
                    className="bg-nostr-dark hover:bg-nostr-darker p-3 rounded-lg text-sm text-white transition-colors"
                  >
                    🆔 Claim Identity
                  </Link>
                  <Link
                    to="/dashboard?tab=subscription"
                    className="bg-nostr-dark hover:bg-nostr-darker p-3 rounded-lg text-sm text-white transition-colors"
                  >
                    💳 Subscription
                  </Link>
                  <Link
                    to={`/receipt/${paymentId}`}
                    className="bg-nostr-dark hover:bg-nostr-darker p-3 rounded-lg text-sm text-white transition-colors"
                  >
                    🧾 Receipt
                  </Link>
                </div>
              </div>

              <div className="text-sm text-gray-400 mb-6">
                <p>Need help? Check our documentation or reach out on Nostr.</p>
              </div>

              <button onClick={onComplete} className="ui-cta w-full">
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
