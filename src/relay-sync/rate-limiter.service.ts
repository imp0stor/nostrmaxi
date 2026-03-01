import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RelayRateState {
  requests: number[];
  backoffUntil: number;
  retryCount: number;
  targetRpm: number;
  successStreak: number;
  consecutive429: number;
  quarantinedUntil: number;
  lastRequestAt: number;
  lastSuccessAt: number;
  lastRateErrorAt: number;
}

interface PersistedRateState {
  version: 1;
  updatedAt: number;
  relays: Record<string, Omit<RelayRateState, 'requests'> & { requests?: number[] }>;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly relayStates = new Map<string, RelayRateState>();
  private readonly requestDelayMs: number;
  private readonly minRpm: number;
  private readonly maxRpmMultiplier: number;
  private readonly successRampEvery: number;
  private readonly rateStateConfigKey = 'relay_rate_state_v1';
  private loadPromise: Promise<void> | null = null;
  private persistTimer: NodeJS.Timeout | null = null;

  private readonly relayLimits: Record<string, number> = {
    'wss://relay.damus.io': 50,
    'wss://relay.primal.net': 100,
    'wss://nos.lol': 30,
  };

  constructor(private readonly prisma?: PrismaService) {
    this.requestDelayMs = Number(process.env.RELAY_SYNC_REQUEST_DELAY_MS || 250);
    this.minRpm = Number(process.env.RELAY_SYNC_MIN_RPM || 5);
    this.maxRpmMultiplier = Number(process.env.RELAY_SYNC_MAX_RPM_MULTIPLIER || 2);
    this.successRampEvery = Number(process.env.RELAY_SYNC_SUCCESS_RAMP_EVERY || 5);
  }

  getRateLimit(relay: string): number {
    return this.getRelayState(relay).targetRpm;
  }

  async waitForSlot(relay: string): Promise<void> {
    await this.ensureLoaded();

    const state = this.getRelayState(relay);
    const now = Date.now();

    if (state.quarantinedUntil > now) {
      await this.sleep(state.quarantinedUntil - now);
    }

    if (state.backoffUntil > Date.now()) {
      await this.sleep(state.backoffUntil - Date.now());
    }

    const minuteAgo = Date.now() - 60_000;
    state.requests = state.requests.filter((ts) => ts >= minuteAgo);

    const maxRequests = Math.max(this.minRpm, state.targetRpm);
    if (state.requests.length >= maxRequests) {
      const oldest = state.requests[0];
      const waitMs = Math.max(0, oldest + 60_000 - Date.now());
      if (waitMs > 0) {
        await this.sleep(waitMs);
      }
      state.requests = state.requests.filter((ts) => ts >= Date.now() - 60_000);
    }

    const minIntervalMs = Math.ceil(60_000 / Math.max(1, maxRequests));
    const elapsedSinceLastRequest = Date.now() - state.lastRequestAt;
    if (state.lastRequestAt > 0 && elapsedSinceLastRequest < minIntervalMs) {
      await this.sleep(minIntervalMs - elapsedSinceLastRequest);
    }

    if (this.requestDelayMs > 0) {
      await this.sleep(this.requestDelayMs);
    }

    const ts = Date.now();
    state.lastRequestAt = ts;
    state.requests.push(ts);
    this.schedulePersist();
  }

  register429(relay: string): number {
    const state = this.getRelayState(relay);

    state.retryCount += 1;
    state.consecutive429 += 1;
    state.successStreak = 0;
    state.lastRateErrorAt = Date.now();

    const decayed = Math.max(this.minRpm, Math.floor(state.targetRpm * 0.7));
    state.targetRpm = decayed;

    const cappedRetries = Math.min(state.retryCount, 6);
    const backoffMs = 1_000 * Math.pow(2, cappedRetries);
    state.backoffUntil = Date.now() + backoffMs;

    if (state.consecutive429 >= 3) {
      const quarantineLevel = Math.min(state.consecutive429 - 3, 4);
      const quarantineMs = 5 * 60_000 * Math.pow(2, quarantineLevel);
      state.quarantinedUntil = Math.max(state.quarantinedUntil, Date.now() + quarantineMs);
      this.logger.warn(`Relay ${relay} quarantined for ${quarantineMs}ms after repeated 429s`);
    }

    this.logger.warn(`Relay ${relay} returned 429, backing off for ${backoffMs}ms (target ${state.targetRpm} rpm)`);
    this.schedulePersist();
    return backoffMs;
  }

  registerSuccess(relay: string): void {
    const state = this.getRelayState(relay);
    state.retryCount = 0;
    state.backoffUntil = 0;
    state.consecutive429 = 0;
    state.lastSuccessAt = Date.now();
    state.successStreak += 1;

    const maxRpm = Math.max(this.minRpm, Math.floor(this.getBaseRateLimit(relay) * this.maxRpmMultiplier));
    if (state.successStreak >= this.successRampEvery && state.targetRpm < maxRpm) {
      state.targetRpm += 1;
      state.successStreak = 0;
    }

    if (state.quarantinedUntil > 0 && state.quarantinedUntil <= Date.now()) {
      state.quarantinedUntil = 0;
    }

    this.schedulePersist();
  }

  registerFailure(relay: string): void {
    const state = this.getRelayState(relay);
    state.successStreak = 0;
    this.schedulePersist();
  }

  clearBackoff(relay: string): void {
    this.registerSuccess(relay);
  }

  getState(relay: string): RelayRateState {
    return { ...this.getRelayState(relay), requests: [...this.getRelayState(relay).requests] };
  }

  getOrderedRelays(relays: string[]): string[] {
    return [...relays]
      .sort((a, b) => this.getRelayScore(b) - this.getRelayScore(a) || a.localeCompare(b));
  }

  getRelayDebugStates(relays?: string[]): Array<{ relay: string; state: RelayRateState; effectiveAvailability: number }> {
    const targets = relays?.length ? relays : [...this.relayStates.keys()];
    return targets
      .map((relay) => ({ relay, state: this.getState(relay), effectiveAvailability: this.getRelayScore(relay) }))
      .sort((a, b) => b.effectiveAvailability - a.effectiveAvailability);
  }

  async executeWithRelayRotation<T>(
    relays: string[],
    operation: (relay: string) => Promise<T>,
  ): Promise<T> {
    const orderedRelays = this.getOrderedRelays(relays);
    let lastError: Error | null = null;

    for (const relay of orderedRelays) {
      await this.waitForSlot(relay);

      try {
        const result = await operation(relay);
        this.registerSuccess(relay);
        return result;
      } catch (error) {
        const message = String((error as Error)?.message || error || '');
        if (message.includes('429') || message.toLowerCase().includes('rate')) {
          this.register429(relay);
        } else {
          this.registerFailure(relay);
        }
        lastError = error as Error;
      }
    }

    throw lastError || new Error('No relay available');
  }

  private getRelayScore(relay: string): number {
    const state = this.getRelayState(relay);
    const now = Date.now();
    if (state.quarantinedUntil > now) return -1_000_000 - (state.quarantinedUntil - now);
    if (state.backoffUntil > now) return -100_000 - (state.backoffUntil - now);

    const reliability = Math.max(0, 100 - state.consecutive429 * 25 - state.retryCount * 5);
    return state.targetRpm * 100 + reliability;
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
      targetRpm: this.getBaseRateLimit(relay),
      successStreak: 0,
      consecutive429: 0,
      quarantinedUntil: 0,
      lastRequestAt: 0,
      lastSuccessAt: 0,
      lastRateErrorAt: 0,
    };
    this.relayStates.set(relay, state);
    return state;
  }

  private getBaseRateLimit(relay: string): number {
    return this.relayLimits[relay] || 40;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.prisma) return;
    if (!this.loadPromise) {
      this.loadPromise = this.loadFromDb();
    }
    await this.loadPromise;
  }

  private async loadFromDb(): Promise<void> {
    try {
      const existing = await this.prisma!.config.findUnique({ where: { key: this.rateStateConfigKey } });
      const payload = existing?.value as PersistedRateState | undefined;
      if (!payload?.relays) return;

      for (const [relay, persisted] of Object.entries(payload.relays)) {
        const state = this.getRelayState(relay);
        state.backoffUntil = persisted.backoffUntil || 0;
        state.retryCount = persisted.retryCount || 0;
        state.targetRpm = Math.max(this.minRpm, persisted.targetRpm || this.getBaseRateLimit(relay));
        state.successStreak = persisted.successStreak || 0;
        state.consecutive429 = persisted.consecutive429 || 0;
        state.quarantinedUntil = persisted.quarantinedUntil || 0;
        state.lastRequestAt = persisted.lastRequestAt || 0;
        state.lastSuccessAt = persisted.lastSuccessAt || 0;
        state.lastRateErrorAt = persisted.lastRateErrorAt || 0;
      }
    } catch (error) {
      this.logger.warn(`Failed loading relay rate state from DB: ${(error as Error).message}`);
    }
  }

  private schedulePersist(): void {
    if (!this.prisma) return;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistToDb().catch((error) => {
        this.logger.warn(`Failed persisting relay rate state: ${(error as Error).message}`);
      });
    }, 150);
  }

  private async persistToDb(): Promise<void> {
    await this.ensureLoaded();
    if (!this.prisma) return;

    const relays: PersistedRateState['relays'] = {};
    for (const [relay, state] of this.relayStates.entries()) {
      relays[relay] = {
        backoffUntil: state.backoffUntil,
        retryCount: state.retryCount,
        targetRpm: state.targetRpm,
        successStreak: state.successStreak,
        consecutive429: state.consecutive429,
        quarantinedUntil: state.quarantinedUntil,
        lastRequestAt: state.lastRequestAt,
        lastSuccessAt: state.lastSuccessAt,
        lastRateErrorAt: state.lastRateErrorAt,
      };
    }

    const payload: PersistedRateState = {
      version: 1,
      updatedAt: Date.now(),
      relays,
    };

    await this.prisma.config.upsert({
      where: { key: this.rateStateConfigKey },
      update: {
        value: payload as any,
        type: 'json',
        category: 'relay-sync',
        description: 'Adaptive per-relay rate control state',
      },
      create: {
        key: this.rateStateConfigKey,
        value: payload as any,
        type: 'json',
        category: 'relay-sync',
        description: 'Adaptive per-relay rate control state',
      },
    });
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
