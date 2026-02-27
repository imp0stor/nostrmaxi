import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface HomePageProps {
  onLogin: () => void;
}

export function HomePage({ onLogin }: HomePageProps) {
  const { isAuthenticated } = useAuth();

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <section className="cy-card p-8">
        <p className="cy-kicker">YOUR NOSTR IDENTITY</p>
        <h1 className="cy-title text-4xl">Claim a simple NIP-05 identity in minutes</h1>
        <p className="text-gray-300 mt-4 max-w-3xl">
          NostrMaxi helps individual users register and manage one verified NIP-05 + Lightning address,
          with a fast setup flow and no enterprise complexity.
        </p>
        <div className="mt-6 flex gap-3 flex-wrap">
          {isAuthenticated ? <Link to="/nip05" className="cy-btn">Manage my NIP-05</Link> : <button onClick={onLogin} className="cy-btn">Authenticate</button>}
          <Link to="/onboarding" className="cy-btn-secondary">Quick setup</Link>
          <Link to="/pricing" className="cy-btn-secondary">View NIP-05 plans</Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {[
          ['Pick your name', 'Choose your preferred NIP-05 handle and connect your npub.'],
          ['Pay with Lightning', 'Complete checkout in seconds with Lightning invoices.'],
          ['Use everywhere', 'Your verified NIP-05 works across Nostr clients immediately.'],
        ].map(([title, desc]) => (
          <div className="cy-panel p-4" key={title}>
            <h3 className="text-cyan-300 font-semibold">{title}</h3>
            <p className="text-sm text-gray-400 mt-2">{desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
