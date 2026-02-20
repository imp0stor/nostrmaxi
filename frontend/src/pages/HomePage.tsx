import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { IdentityChecker } from '../components/IdentityChecker';

interface HomePageProps {
  onLogin: () => void;
}

export function HomePage({ onLogin }: HomePageProps) {
  const { isAuthenticated } = useAuth();

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-nostr-purple/20 via-transparent to-nostr-orange/20" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Your Identity on{' '}
              <span className="text-gradient">Nostr</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-8">
              Get verified with NIP-05 identity. Pay with Lightning.
              No KYC. No hassle. Just your keys, your identity.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="px-8 py-4 bg-nostr-purple hover:bg-nostr-purple/80 text-white font-bold rounded-lg text-lg"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <button
                  onClick={onLogin}
                  className="px-8 py-4 bg-nostr-purple hover:bg-nostr-purple/80 text-white font-bold rounded-lg text-lg"
                >
                  Get Started
                </button>
              )}
              <Link
                to="/pricing"
                className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg text-lg"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Identity Checker Section */}
      <section className="py-16 bg-nostr-darker">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <IdentityChecker />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-nostr-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">
            Why <span className="text-gradient">NostrMaxi</span>?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-nostr-darker rounded-xl p-6 border border-gray-800">
              <div className="w-12 h-12 bg-nostr-purple/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-nostr-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">NIP-05 Verification</h3>
              <p className="text-gray-400">
                Get a verified identity like user@nostrmaxi.com that works across all Nostr clients.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-nostr-darker rounded-xl p-6 border border-gray-800">
              <div className="w-12 h-12 bg-nostr-orange/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-nostr-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Lightning Payments</h3>
              <p className="text-gray-400">
                Pay instantly with Bitcoin Lightning. No credit cards, no KYC, no waiting.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-nostr-darker rounded-xl p-6 border border-gray-800">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Web of Trust</h3>
              <p className="text-gray-400">
                Trusted users get discounts. Build reputation, save sats.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: 1, title: 'Login', desc: 'Connect with your Nostr extension or Lightning wallet' },
              { step: 2, title: 'Choose Plan', desc: 'Pick free or upgrade for custom domains' },
              { step: 3, title: 'Pay with ⚡', desc: 'Scan QR code with your Lightning wallet' },
              { step: 4, title: 'Verified!', desc: 'Your NIP-05 identity is active instantly' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-nostr-purple rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-nostr-purple/20 to-nostr-orange/20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to claim your identity?</h2>
          <p className="text-gray-400 mb-8">
            Join thousands of Nostr users with verified identities.
          </p>
          {isAuthenticated ? (
            <Link
              to="/nip05"
              className="inline-block px-8 py-4 bg-nostr-purple hover:bg-nostr-purple/80 text-white font-bold rounded-lg text-lg"
            >
              Claim Your NIP-05
            </Link>
          ) : (
            <button
              onClick={onLogin}
              className="px-8 py-4 bg-nostr-purple hover:bg-nostr-purple/80 text-white font-bold rounded-lg text-lg"
            >
              Get Started Free
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
