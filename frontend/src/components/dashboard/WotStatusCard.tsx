import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';

interface WotScore {
  score: number;
  depth: number;
  followerCount: number;
  followingCount: number;
  trustLevel: 'unknown' | 'low' | 'medium' | 'high' | 'verified';
  discount: number;
  lastCalculated: string;
  usingRealRelays: boolean;
}

export function WotStatusCard() {
  const { user } = useAuth();
  const [wotScore, setWotScore] = useState<WotScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => {
    if (user?.npub) {
      loadWotScore();
    }
  }, [user?.npub]);

  const loadWotScore = async () => {
    if (!user?.npub) return;

    try {
      setIsLoading(true);
      const data = await api.getWotScore(user.npub);
      setWotScore(data);
    } catch (err) {
      // Use mock data on error
      setWotScore({
        score: user?.wotScore || 42,
        depth: 2,
        followerCount: 127,
        followingCount: 84,
        trustLevel: 'medium',
        discount: 10,
        lastCalculated: new Date().toISOString(),
        usingRealRelays: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecalculate = async () => {
    if (!user?.npub || isRecalculating) return;

    try {
      setIsRecalculating(true);
      const data = await api.recalculateWot(user.npub, true); // Use real relays
      setWotScore(data);
    } catch (err) {
      console.error('Failed to recalculate WoT:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  if (!user) return null;

  const getTrustLevelColor = (level: string) => {
    switch (level) {
      case 'verified':
        return 'text-green-400 bg-green-400/20';
      case 'high':
        return 'text-blue-400 bg-blue-400/20';
      case 'medium':
        return 'text-yellow-400 bg-yellow-400/20';
      case 'low':
        return 'text-orange-400 bg-orange-400/20';
      default:
        return 'text-gray-400 bg-gray-400/20';
    }
  };

  const getTrustLevelLabel = (level: string) => {
    switch (level) {
      case 'verified':
        return 'Verified';
      case 'high':
        return 'High Trust';
      case 'medium':
        return 'Medium Trust';
      case 'low':
        return 'Low Trust';
      default:
        return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <div className="ui-card">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-nostr-purple border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!wotScore) return null;

  return (
    <div className="ui-card space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Web of Trust</h3>
          <p className="ui-muted text-sm">Your reputation on Nostr</p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={isRecalculating}
          className="ui-button text-sm"
        >
          {isRecalculating ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-nostr-purple border-t-transparent rounded-full animate-spin" />
              <span>Calculating...</span>
            </div>
          ) : (
            'Recalculate'
          )}
        </button>
      </div>

      {/* Score visualization */}
      <div className="relative">
        <div className="flex items-center justify-center mb-4">
          <div className="relative w-32 h-32">
            {/* Background circle */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-gray-700"
              />
              {/* Progress circle */}
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="url(#wotGradient)"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${(wotScore.score / 100) * 351.858} 351.858`}
                className="transition-all duration-1000"
              />
              <defs>
                <linearGradient id="wotGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
            </svg>

            {/* Score number */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{wotScore.score}</p>
                <p className="text-xs text-gray-400">/ 100</p>
              </div>
            </div>
          </div>
        </div>

        {/* Trust level badge */}
        <div className="text-center mb-4">
          <span
            className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getTrustLevelColor(
              wotScore.trustLevel
            )}`}
          >
            {getTrustLevelLabel(wotScore.trustLevel)}
          </span>
        </div>

        {/* Discount indicator */}
        {wotScore.discount > 0 && (
          <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-lg p-3 border border-green-500/30 text-center">
            <p className="text-green-400 font-semibold">
              🎉 {wotScore.discount}% Discount Unlocked!
            </p>
            <p className="text-green-400/70 text-xs mt-1">
              High trust users save sats on upgrades
            </p>
          </div>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{wotScore.depth}</p>
          <p className="ui-muted text-xs">Trust Depth</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{wotScore.followerCount}</p>
          <p className="ui-muted text-xs">Followers</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{wotScore.followingCount}</p>
          <p className="ui-muted text-xs">Following</p>
        </div>
      </div>

      <div className="ui-divider" />

      {/* Info footer */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between text-gray-400">
          <span>Data Source</span>
          <span className={wotScore.usingRealRelays ? 'text-green-400' : 'text-yellow-400'}>
            {wotScore.usingRealRelays ? 'Live Relays ✓' : 'Mock Data'}
          </span>
        </div>
        <div className="flex items-center justify-between text-gray-400">
          <span>Last Updated</span>
          <span>{new Date(wotScore.lastCalculated).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Help text */}
      <div className="bg-nostr-darker rounded-lg p-3">
        <p className="text-xs text-gray-400">
          <strong className="text-white">What is Web of Trust?</strong>
          <br />
          WoT measures your reputation based on connections to trusted Nostr users. Higher scores
          unlock discounts and prove you're not a bot.
        </p>
      </div>
    </div>
  );
}
