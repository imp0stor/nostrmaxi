import { Injectable } from '@nestjs/common';

export interface SearchMetricsSnapshot {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  lastLatencyMs: number;
  lastError?: string;
  lastErrorAt?: string;
}

@Injectable()
export class SearchMetricsService {
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private cacheHits = 0;
  private lastLatencyMs = 0;
  private lastError?: string;
  private lastErrorAt?: string;

  recordRequest() {
    this.totalRequests += 1;
  }

  recordSuccess(latencyMs: number) {
    this.successfulRequests += 1;
    this.lastLatencyMs = latencyMs;
  }

  recordFailure(error: unknown) {
    this.failedRequests += 1;
    this.lastError = error instanceof Error ? error.message : String(error);
    this.lastErrorAt = new Date().toISOString();
  }

  recordCacheHit() {
    this.cacheHits += 1;
  }

  snapshot(): SearchMetricsSnapshot {
    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      cacheHits: this.cacheHits,
      lastLatencyMs: this.lastLatencyMs,
      lastError: this.lastError,
      lastErrorAt: this.lastErrorAt,
    };
  }
}
