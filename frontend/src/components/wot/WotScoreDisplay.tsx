import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Shield, Users, TrendingUp, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface WotScore {
  pubkey: string;
  npub: string;
  trustScore: number;
  followersCount: number;
  followingCount: number;
  wotDepth: number;
  isLikelyBot: boolean;
  discountPercent: number;
  lastCalculated: string;
}

const WotScoreDisplay: React.FC<{ pubkey?: string }> = ({ pubkey }) => {
  const [score, setScore] = useState<WotScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputPubkey, setInputPubkey] = useState(pubkey || '');

  const fetchScore = async (pk: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/wot/score/${pk}`);
      if (!response.ok) {
        throw new Error('Failed to fetch WoT score');
      }
      const data = await response.json();
      setScore(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const recalculateScore = async (useRealRelays: boolean = false) => {
    if (!inputPubkey) return;

    setCalculating(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/wot/recalculate/${inputPubkey}?useRealRelays=${useRealRelays}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to recalculate WoT score');
      }

      const data = await response.json();
      setScore(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCalculating(false);
    }
  };

  const getTrustLevel = (trustScore: number): { label: string; color: string } => {
    if (trustScore >= 80) return { label: 'Highly Trusted', color: 'text-green-600' };
    if (trustScore >= 50) return { label: 'Trusted', color: 'text-blue-600' };
    if (trustScore >= 20) return { label: 'Moderate', color: 'text-yellow-600' };
    return { label: 'Low Trust', color: 'text-red-600' };
  };

  const getWotDepthDescription = (depth: number): string => {
    if (depth === 0) return 'Trust anchor';
    if (depth === 1) return 'Followed by trust anchor';
    if (depth === 2) return '2 hops from trust anchor';
    return 'Not in Web of Trust';
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle>Check Web of Trust Score</CardTitle>
          <CardDescription>
            Enter a pubkey (hex or npub) to check trust score and network position
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="npub1... or hex pubkey"
              value={inputPubkey}
              onChange={(e) => setInputPubkey(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <Button onClick={() => fetchScore(inputPubkey)} disabled={loading || !inputPubkey}>
              {loading ? 'Loading...' : 'Check Score'}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Score Display */}
      {score && (
        <>
          {/* Main Score Card */}
          <Card className="border-2 border-purple-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-6 h-6 text-purple-600" />
                    Web of Trust Score
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {score.npub || score.pubkey.slice(0, 16) + '...'}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => recalculateScore(false)}
                    disabled={calculating}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${calculating ? 'animate-spin' : ''}`} />
                    Quick Refresh
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => recalculateScore(true)}
                    disabled={calculating}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${calculating ? 'animate-spin' : ''}`} />
                    Real Relays
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Trust Score Meter */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Trust Score</span>
                  <span className={`text-2xl font-bold ${getTrustLevel(score.trustScore).color}`}>
                    {score.trustScore}/100
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      score.trustScore >= 80
                        ? 'bg-green-500'
                        : score.trustScore >= 50
                        ? 'bg-blue-500'
                        : score.trustScore >= 20
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${score.trustScore}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-sm font-medium ${getTrustLevel(score.trustScore).color}`}>
                    {getTrustLevel(score.trustScore).label}
                  </span>
                  {score.isLikelyBot && (
                    <span className="flex items-center gap-1 text-sm text-red-600">
                      <AlertTriangle className="w-4 h-4" />
                      Possible Bot
                    </span>
                  )}
                  {!score.isLikelyBot && score.trustScore >= 50 && (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      Verified Human
                    </span>
                  )}
                </div>
              </div>

              {/* Network Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <Users className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{score.followersCount.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">Followers</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{score.followingCount.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">Following</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{score.wotDepth === -1 ? '∞' : score.wotDepth}</div>
                  <div className="text-xs text-gray-600">WoT Depth</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <Shield className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{score.discountPercent}%</div>
                  <div className="text-xs text-gray-600">Discount</div>
                </div>
              </div>

              {/* WoT Depth Explanation */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm font-medium text-gray-700 mb-1">Network Position</div>
                <div className="text-sm text-gray-600">{getWotDepthDescription(score.wotDepth)}</div>
              </div>

              {/* Discount Eligibility */}
              {score.discountPercent > 0 && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-green-900 font-semibold mb-1">
                    <CheckCircle className="w-5 h-5" />
                    Discount Eligible!
                  </div>
                  <div className="text-sm text-green-700">
                    Your trust score of {score.trustScore} qualifies you for a {score.discountPercent}% discount on all paid tiers.
                  </div>
                </div>
              )}

              {/* Last Updated */}
              <div className="text-xs text-gray-500 text-center">
                Last calculated: {new Date(score.lastCalculated).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">About Web of Trust Scoring</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <p>
                <strong>Trust Score (0-100):</strong> Calculated based on your follower count, network position, account age, and activity level.
              </p>
              <p>
                <strong>WoT Depth:</strong> Number of hops from well-known trust anchor accounts. Lower is better.
              </p>
              <p>
                <strong>Discounts:</strong> High trust scores (50+) qualify for automatic discounts on subscription tiers.
              </p>
              <p>
                <strong>Real Relays:</strong> Click "Real Relays" to query live Nostr relays for the most accurate scoring (slower but precise).
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default WotScoreDisplay;
