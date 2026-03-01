import { Link } from 'react-router-dom';

interface PremiumInterstitialProps {
  featureName: string;
}

export function PremiumInterstitial({ featureName }: PremiumInterstitialProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="cy-card p-8 border border-orange-500/40">
        <p className="cy-kicker">PREMIUM FEATURE</p>
        <h1 className="cy-title mt-2">{featureName} is locked</h1>
        <p className="mt-3 text-swordfish-muted">
          Upgrade to a paid tier to unlock full analytics and premium tooling.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/pricing" className="cy-button">Upgrade now</Link>
          <Link to="/feed" className="cy-button-ghost">Back to feed</Link>
        </div>
      </div>
    </div>
  );
}
