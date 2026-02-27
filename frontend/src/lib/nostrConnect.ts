import { SimplePool, finalizeEvent, generateSecretKey, getPublicKey, type UnsignedEvent } from 'nostr-tools';
import * as nip04 from 'nostr-tools/nip04';
import type { NostrEvent } from '../types';

const DEFAULT_RELAYS = ['wss://relay.nsec.app', 'wss://relay.damus.io'];
const NOSTR_CONNECT_KIND = 24133;

const HEX_64_REGEX = /^[a-f0-9]{64}$/i;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export interface NostrConnectMetadata {
  name: string;
  url?: string;
  description?: string;
  icons?: string[];
}

export interface NostrConnectInitOptions {
  relays?: string[];
  metadata?: NostrConnectMetadata;
}

export interface BunkerUriConfig {
  signerPubkey: string;
  relays: string[];
  secret?: string;
}

export class NostrConnectClient {
  private pool: SimplePool | null = null;
  private relays: string[] = DEFAULT_RELAYS;
  private metadata: NostrConnectMetadata = { name: 'NostrMaxi' };

  private clientSecretHex = '';
  private clientSecret: Uint8Array = new Uint8Array(0);
  private clientPubkey = '';
  private signerPubkey: string | null = null;
  private bunkerSecret: string | null = null;

  private connectedPromise: Promise<string> | null = null;
  private resolveConnected: ((pubkey: string) => void) | null = null;
  private rejectConnected: ((error: Error) => void) | null = null;

  private pending = new Map<string, PendingRequest>();
  private subCloser: { close: (reason?: string) => void } | null = null;

  initialize(options?: NostrConnectInitOptions): string {
    this.setupSession(options);
    return this.getConnectionUri();
  }

  initializeFromBunkerUri(uri: string, options?: Pick<NostrConnectInitOptions, 'metadata'>): BunkerUriConfig {
    const parsed = NostrConnectClient.parseBunkerUri(uri);

    this.setupSession({
      relays: parsed.relays,
      metadata: options?.metadata ?? this.metadata,
    });

    this.signerPubkey = parsed.signerPubkey;
    this.bunkerSecret = parsed.secret ?? null;
    this.resolveConnected?.(parsed.signerPubkey);

    return parsed;
  }

  static parseBunkerUri(uri: string): BunkerUriConfig {
    const trimmed = uri.trim();
    if (!trimmed) {
      throw new Error('Bunker URI is required');
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error('Invalid bunker URI format');
    }

    if (parsed.protocol !== 'bunker:') {
      throw new Error('Bunker URI must start with bunker://');
    }

    const signerPubkey = (parsed.hostname || parsed.pathname.replace(/^\//, '')).trim();
    if (!HEX_64_REGEX.test(signerPubkey)) {
      throw new Error('Bunker URI signer pubkey must be a 64-character hex key');
    }

    const relays = parsed.searchParams
      .getAll('relay')
      .map((relay) => relay.trim())
      .filter(Boolean);

    if (relays.length === 0) {
      throw new Error('Bunker URI must include at least one relay query param');
    }

    const invalidRelay = relays.find((relay) => !/^wss?:\/\//i.test(relay));
    if (invalidRelay) {
      throw new Error(`Invalid relay URL in bunker URI: ${invalidRelay}`);
    }

    const secret = parsed.searchParams.get('secret')?.trim() || undefined;

    return {
      signerPubkey,
      relays,
      secret,
    };
  }

  getConnectionUri(): string {
    const params = new URLSearchParams();
    this.relays.forEach((relay) => params.append('relay', relay));
    // Use 'name', 'url', 'image' params for Primal compatibility (not just 'metadata')
    if (this.metadata.name) params.set('name', this.metadata.name);
    if (this.metadata.url) params.set('url', this.metadata.url);
    if (this.metadata.icons?.[0]) params.set('image', this.metadata.icons[0]);
    params.set('metadata', JSON.stringify(this.metadata));
    // Use nostrconnect:// (no + sign) for Primal compatibility
    return `nostrconnect://${this.clientPubkey}?${params.toString()}`;
  }

  async waitForSigner(timeoutMs = 90000): Promise<string> {
    if (!this.connectedPromise) {
      throw new Error('Nostr Connect not initialized');
    }

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('No signer connected in time. Please retry or use fallback login.'));
      }, timeoutMs);

      this.connectedPromise!
        .then((pubkey) => {
          clearTimeout(timeout);
          resolve(pubkey);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  async getUserPubkey(timeoutMs = 45000): Promise<string> {
    await this.waitForSigner(timeoutMs);

    if (this.bunkerSecret) {
      await this.sendRequest('connect', [this.clientPubkey, this.bunkerSecret], timeoutMs);
    }

    const result = await this.sendRequest('get_public_key', [], timeoutMs);

    if (typeof result !== 'string' || !HEX_64_REGEX.test(result)) {
      throw new Error('Signer did not return a valid public key');
    }

    return result;
  }

  async signEvent(unsignedEvent: Omit<NostrEvent, 'id' | 'sig'>, timeoutMs = 45000): Promise<NostrEvent> {
    await this.waitForSigner(timeoutMs);

    const result = await this.sendRequest('sign_event', [JSON.stringify(unsignedEvent)], timeoutMs);

    let parsed: unknown = result;
    if (typeof result === 'string') {
      parsed = JSON.parse(result) as unknown;
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Signer returned malformed sign_event response');
    }

    const event = parsed as NostrEvent;
    if (!event.id || !event.sig || !event.pubkey) {
      throw new Error('Signer response missing event signature fields');
    }

    return event;
  }

  cleanup(): void {
    this.subCloser?.close('nostr-connect-cleanup');
    this.subCloser = null;

    if (this.pool) {
      this.pool.close(this.relays);
      this.pool = null;
    }

    this.pending.forEach((entry) => {
      clearTimeout(entry.timeout);
      entry.reject(new Error('Nostr Connect session closed'));
    });
    this.pending.clear();

    this.rejectConnected?.(new Error('Nostr Connect session closed'));

    this.connectedPromise = null;
    this.resolveConnected = null;
    this.rejectConnected = null;

    this.signerPubkey = null;
    this.bunkerSecret = null;
    this.clientPubkey = '';
    this.clientSecretHex = '';
    this.clientSecret = new Uint8Array(0);
  }

  private setupSession(options?: NostrConnectInitOptions): void {
    this.cleanup();

    this.pool = new SimplePool();
    this.relays = options?.relays?.length ? options.relays : DEFAULT_RELAYS;
    this.metadata = options?.metadata ?? this.metadata;

    this.clientSecret = generateSecretKey();
    this.clientSecretHex = Array.from(this.clientSecret).map((b) => b.toString(16).padStart(2, '0')).join('');
    this.clientPubkey = getPublicKey(this.clientSecret);

    this.connectedPromise = new Promise<string>((resolve, reject) => {
      this.resolveConnected = resolve;
      this.rejectConnected = reject;
    });

    console.log('[NostrConnect] Setting up subscription on relays:', this.relays);
    console.log('[NostrConnect] Client pubkey:', this.clientPubkey);
    
    this.subCloser = this.pool.subscribeMany(
      this.relays,
      {
        kinds: [NOSTR_CONNECT_KIND],
        '#p': [this.clientPubkey],
        since: Math.floor(Date.now() / 1000) - 60, // Extend lookback to 60 seconds
      } as Parameters<SimplePool['subscribeMany']>[1],
      {
        onevent: (event) => {
          console.log('[NostrConnect] Received event:', event.kind, 'from:', event.pubkey?.slice(0, 8));
          void this.handleIncomingEvent(event as NostrEvent);
        },
        oneose: () => {
          console.log('[NostrConnect] End of stored events received');
        },
      }
    );
  }

  private async handleIncomingEvent(event: NostrEvent): Promise<void> {
    if (!this.clientSecretHex) {
      console.log('[NostrConnect] Ignoring event - no client secret');
      return;
    }

    try {
      console.log('[NostrConnect] Attempting to decrypt event from:', event.pubkey?.slice(0, 8));
      const decrypted = await nip04.decrypt(this.clientSecretHex, event.pubkey, event.content);
      console.log('[NostrConnect] Decrypted payload:', decrypted?.slice(0, 100));
      const payload = JSON.parse(decrypted) as { id?: string; result?: unknown; error?: string | { message?: string }; method?: string };

      if (!this.signerPubkey) {
        console.log('[NostrConnect] Signer connected! Pubkey:', event.pubkey?.slice(0, 16));
        this.signerPubkey = event.pubkey;
        this.resolveConnected?.(event.pubkey);
      }

      // Handle incoming method calls (signer initiated)
      if (payload.method) {
        console.log('[NostrConnect] Received method call:', payload.method);
        return;
      }

      if (!payload.id) {
        console.log('[NostrConnect] No payload id, ignoring');
        return;
      }

      const entry = this.pending.get(payload.id);
      if (!entry) {
        console.log('[NostrConnect] No pending request for id:', payload.id);
        return;
      }

      clearTimeout(entry.timeout);
      this.pending.delete(payload.id);

      if (payload.error) {
        const message = typeof payload.error === 'string' ? payload.error : payload.error.message;
        console.log('[NostrConnect] Signer returned error:', message);
        entry.reject(new Error(message || 'Signer rejected request'));
        return;
      }

      console.log('[NostrConnect] Signer returned result for:', payload.id);
      entry.resolve(payload.result);
    } catch (err) {
      console.log('[NostrConnect] Failed to process event:', (err as Error)?.message);
      // Ignore events that are not decryptable for this session.
    }
  }

  private async sendRequest(method: string, params: unknown[], timeoutMs = 30000): Promise<unknown> {
    if (!this.pool) {
      throw new Error('Nostr Connect is not initialized');
    }

    if (!this.signerPubkey) {
      throw new Error('Signer not connected yet');
    }

    const id = crypto.randomUUID();
    const payload = JSON.stringify({ id, method, params });
    const encrypted = await nip04.encrypt(this.clientSecretHex, this.signerPubkey, payload);

    const unsigned: UnsignedEvent = {
      kind: NOSTR_CONNECT_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', this.signerPubkey]],
      content: encrypted,
      pubkey: this.clientPubkey,
    };

    const signed = finalizeEvent(unsigned, this.clientSecret);

    const promise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Signer timed out (${method})`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timeout });
    });

    const publishResults = await Promise.allSettled(this.pool.publish(this.relays, signed));
    if (!publishResults.some((result) => result.status === 'fulfilled')) {
      throw new Error('Failed to publish signer request to configured relays');
    }

    return promise;
  }
}
