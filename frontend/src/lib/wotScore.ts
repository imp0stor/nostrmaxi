export interface PrimitiveWotScoreResponse {
  trustScore?: number | null;
  distanceLabel?: string | null;
  scoreState?: 'calculated' | 'unknown' | string;
}

export interface FeedWotMetric {
  trustScore: number | null;
  scoreLabel: string;
  distanceLabel: string;
  ariaLabel: string;
  scoreState: 'calculated' | 'unknown';
}

export function mapPrimitiveWotToFeedMetric(input: PrimitiveWotScoreResponse): FeedWotMetric {
  const numericScore = typeof input.trustScore === 'number' && Number.isFinite(input.trustScore)
    ? Math.max(0, Math.min(100, Math.round(input.trustScore)))
    : null;

  const explicitUnknown = input.scoreState === 'unknown' || input.distanceLabel === 'unknown';
  const scoreState: 'calculated' | 'unknown' = (explicitUnknown || numericScore === null)
    ? 'unknown'
    : 'calculated';

  const distanceLabel = input.distanceLabel || 'unknown';
  const scoreLabel = scoreState === 'unknown' ? 'unknown' : String(numericScore);
  const ariaLabel = scoreState === 'unknown'
    ? `Web of trust score unknown, ${distanceLabel}`
    : `Web of trust score ${numericScore}, ${distanceLabel}`;

  return {
    trustScore: scoreState === 'unknown' ? null : numericScore,
    scoreLabel,
    distanceLabel,
    ariaLabel,
    scoreState,
  };
}
