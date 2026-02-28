import { Injectable, Logger } from '@nestjs/common';

interface RelayRateState {
  requests: number[];
  backoffUntil: number;
  retryCount: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly relayStates = new Map<string, RelayRateState>();

  private readonly relayLimits: Record<string, number> = {
    'wss://relay.damus.io': 50,
    'wss://relay.primal.net': 100,
    'wss://nos.lol': 30,
  };

  constructor(private readonly requestDelayMs = Number(process.env.RELAY_SYNC_REQUEST_DELAY_MS || 250)) {}

  getRateLimit(relay: string): number {
    return this.relayLimits[relay] || 40;
  }

  private getRelayState(relay: string): RelayRateState {
    const existing = this.relayStates.get(relay);
    if (existing) {
      return existing;
    }

    const state: RelayRateState = {
      requests: [],
      backoffUntil: 0,
      retryCount: 0,
    };
    this.relayStates.set(relay, state);
    return state;
  }

  async waitForSlot(relay: string): Promise<void> {
    const state = this.getRelayState(relay);
    const now = Date.now();

    if (state.backoffUntil > now) {
      await this.sleep(state.backoffUntil - now);
    }

    const minuteAgo = Date.now() - 60_000;
    state.requests = state.requests.filter((ts) => ts >= minuteAgo);

    const maxRequests = this.getRateLimit(relay);
    if (state.requests.length >= maxRequests) {
      const oldest = state.requests[0];
      const waitMs = Math.max(0, oldest + 60_000 - Date.now());
      if (waitMs > 0) {
        await this.sleep(waitMs);
      }
      state.requests = state.requests.filter((ts) => ts >= Date.now() - 60_000);
    }

    if (this.requestDelayMs > 0) {
      await this.sleep(this.requestDelayMs);
    }

    state.requests.push(Date.now());
  }

  register429(relay: string): number {
    const state = this.getRelayState(relay);
    state.retryCount += 1;

    const cappedRetries = Math.min(state.retryCount, 6);
    const backoffMs = 1_000 * Math.pow(2, cappedRetries);
    state.backoffUntil = Date.now() + backoffMs;

    this.logger.warn(`Relay ${relay} returned 429, backing off for ${backoffMs}ms`);
    return backoffMs;
  }

  clearBackoff(relay: string): void {
    const state = this.getRelayState(relay);
    state.retryCount = 0;
    state.backoffUntil = 0;
  }

  getState(relay: string): RelayRateState {
    return { ...this.getRelayState(relay) };
  }

  async executeWithRelayRotation<T>(
    relays: string[],
    operation: (relay: string) => Promise<T>,
  ): Promise<T> {
    const orderedRelays = [...relays].sort((a, b) => this.getState(a).backoffUntil - this.getState(b).backoffUntil);
    let lastError: Error | null = null;

    for (const relay of orderedRelays) {
      await this.waitForSlot(relay);

      try {
        const result = await operation(relay);
        this.clearBackoff(relay);
        return result;
      } catch (error) {
        const message = String((error as Error)?.message || error || '');
        if (message.includes('429') || message.toLowerCase().includes('rate')) {
          this.register429(relay);
        }
        lastError = error as Error;
      }
    }

    throw lastError || new Error('No relay available');
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
