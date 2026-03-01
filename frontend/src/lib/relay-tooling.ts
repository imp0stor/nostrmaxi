/**
 * Local relay tooling utilities for frontend
 * (Inline implementations to avoid ESM/CJS issues with @strangesignal/nostr-relay-tooling)
 */

export interface RelayHealthInput {
  successCount: number;
  failureCount: number;
  avgLatencyMs?: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
}

export interface RelayHealthScore {
  score: number;
  successRate: number;
  latencyScore: number;
  recencyScore: number;
}

export interface RelayCandidate {
  url: string;
  source: 'user' | 'discovered' | 'seed' | 'hint';
  health?: RelayHealthInput;
  rankBoost?: number;
}

export interface RelaySelectionPlan {
  selected: string[];
  ranked: Array<{
    url: string;
    score: number;
    source: RelayCandidate['source'];
    healthScore?: RelayHealthScore;
  }>;
}

const DEFAULT_HEALTH_WEIGHTS = {
  successRate: 0.55,
  latency: 0.3,
  recency: 0.15,
};

/**
 * Compute a health score for a relay based on success/failure metrics
 */
export function scoreRelayHealth(
  input: RelayHealthInput,
  nowMs: number = Date.now()
): RelayHealthScore {
  const total = input.successCount + input.failureCount;
  const successRate = total > 0 ? input.successCount / total : 0.5;

  // Latency score (lower is better, normalize to 0-1)
  const latencyScore = input.avgLatencyMs
    ? Math.max(0, 1 - input.avgLatencyMs / 2000)
    : 0.5;

  // Recency score (more recent success is better)
  let recencyScore = 0.5;
  if (input.lastSuccessAt) {
    const ageMs = nowMs - input.lastSuccessAt;
    recencyScore = Math.max(0, 1 - ageMs / (24 * 60 * 60 * 1000)); // Decay over 24h
  }

  const score =
    successRate * DEFAULT_HEALTH_WEIGHTS.successRate +
    latencyScore * DEFAULT_HEALTH_WEIGHTS.latency +
    recencyScore * DEFAULT_HEALTH_WEIGHTS.recency;

  return { score, successRate, latencyScore, recencyScore };
}

/**
 * Plan relay selection from candidates
 */
export function planRelaySelection(
  candidates: RelayCandidate[],
  options: { fanout?: number; nowMs?: number } = {}
): RelaySelectionPlan {
  const fanout = options.fanout ?? 4;
  const nowMs = options.nowMs ?? Date.now();

  const ranked = candidates.map((c) => {
    const healthScore = c.health ? scoreRelayHealth(c.health, nowMs) : undefined;
    const baseScore = healthScore?.score ?? 0.5;
    const boost = c.rankBoost ?? 0;
    const sourceBonus =
      c.source === 'user' ? 0.2 : c.source === 'seed' ? 0.1 : c.source === 'hint' ? 0.05 : 0;
    return {
      url: c.url,
      score: baseScore + boost + sourceBonus,
      source: c.source,
      healthScore,
    };
  });

  ranked.sort((a, b) => b.score - a.score);

  return {
    selected: ranked.slice(0, fanout).map((r) => r.url),
    ranked,
  };
}
