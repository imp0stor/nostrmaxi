import { nip19, SimplePool, finalizeEvent } from 'nostr-tools';
import type { NostrEvent, NostrProfile, Nip07Nostr } from '../types';
import { fetchProfileCached } from './profileCache';

const NIP07_RETRY_ATTEMPTS = 10;
const NIP07_RETRY_DELAY_MS = 250;

export type NostrProviderId = 'alby' | 'nostrcast' | 'nos2x' | 'window_nostr';

export interface NostrProviderOption {
  id: NostrProviderId;
  label: string;
  source: 'window.nostr' | 'window.nostrKeychain' | 'window.nos2x' | 'window.alby';
  isAvailable: boolean;
  warning?: string;
  unavailableReason?: string;
  provider: Nip07Nostr | null;
}

let lastProviderDebugMarker = 'provider:none';

function markProviderUsage(marker: string) {
  lastProviderDebugMarker = marker;
}

export function getSignerRuntimeDebugMarker(): string {
  return lastProviderDebugMarker;
}

export function providerDisplayName(provider: NostrProviderId): string {
  if (provider === 'alby') return 'Alby';
  if (provider === 'nostrcast') return 'NostrCast Keychain';
  if (provider === 'nos2x') return 'nos2x';
  return 'Browser NIP-07 Signer';
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

function isProviderCompatible(nostr: unknown): nostr is Nip07Nostr {
  if (!nostr || typeof nostr !== 'object') {
    return false;
  }

  const candidate = nostr as Nip07Nostr;
  return isFunction(candidate.getPublicKey) && isFunction(candidate.signEvent);
}

function isLikelyAlbyWindowNostr(nostr: Nip07Nostr | null, w: Window & typeof globalThis): boolean {
  if (!nostr) return false;
  if ((w as any)?.alby?.nostr && nostr === (w as any).alby.nostr) return true;
  const candidate = nostr as unknown as Record<string, unknown>;
  return Boolean(
    (candidate as any).isAlby ||
      (candidate as any).providerName === 'alby' ||
      (candidate as any).extensionName === 'alby' ||
      (candidate as any).extension === 'alby'
  );
}

function isLikelyNos2xWindowNostr(nostr: Nip07Nostr | null): boolean {
  if (!nostr) return false;
  const candidate = nostr as unknown as Record<string, unknown>;
  const extensionName = `${candidate.extensionName ?? candidate.extension ?? candidate.providerName ?? ''}`.toLowerCase();
  return Boolean((candidate as any).isNos2x || extensionName.includes('nos2x'));
}

function getSignerOptions(): NostrProviderOption[] {
  if (typeof window === 'undefined') return [];

  const options: NostrProviderOption[] = [];

  const windowNostr = isProviderCompatible(window.nostr) ? window.nostr : null;
  const keychain = isProviderCompatible(window.nostrKeychain) ? window.nostrKeychain : null;
  const nos2xInjected = isProviderCompatible((window as any).nos2x?.nostr) ? ((window as any).nos2x?.nostr as Nip07Nostr) : null;
  const albyInjected = isProviderCompatible((window as any).alby?.nostr) ? ((window as any).alby?.nostr as Nip07Nostr) : null;

  const windowNostrIsAlby = isLikelyAlbyWindowNostr(windowNostr, window);
  const windowNostrIsNos2x = isLikelyNos2xWindowNostr(windowNostr);

  const albyProvider = albyInjected ?? (windowNostrIsAlby ? windowNostr : null);
  options.push({
    id: 'alby',
    label: 'Alby',
    source: albyInjected ? 'window.alby' : 'window.nostr',
    provider: albyProvider,
    isAvailable: Boolean(albyProvider),
    unavailableReason: albyProvider ? undefined : 'Alby is not independently addressable on window.nostr.',
  });

  const nos2xProvider = nos2xInjected ?? (windowNostrIsNos2x ? windowNostr : null);
  options.push({
    id: 'nos2x',
    label: 'nos2x',
    source: nos2xInjected ? 'window.nos2x' : 'window.nostr',
    provider: nos2xProvider,
    isAvailable: Boolean(nos2xProvider),
    unavailableReason: nos2xProvider
      ? undefined
      : 'nos2x is not independently addressable (window.nostr appears owned by another signer).',
  });

  const unknownWindowProvider = windowNostr && !windowNostrIsAlby && !windowNostrIsNos2x ? windowNostr : null;
  options.push({
    id: 'window_nostr',
    label: 'Browser NIP-07 Signer',
    source: 'window.nostr',
    provider: unknownWindowProvider,
    isAvailable: Boolean(unknownWindowProvider),
    warning: unknownWindowProvider ? 'Unknown window.nostr signer detected. You can still try logging in with this provider.' : undefined,
    unavailableReason: unknownWindowProvider ? undefined : 'window.nostr is controlled by another signer and cannot be selected as a generic provider.',
  });

  options.push({
    id: 'nostrcast',
    label: 'NostrCast Keychain',
    source: 'window.nostrKeychain',
    provider: keychain,
    isAvailable: Boolean(keychain),
    unavailableReason: keychain ? undefined : 'window.nostrKeychain not detected.',
  });

  return options;
}

export function getSignerChoices(): NostrProviderOption[] {
  return getSignerOptions();
}

export function getAvailableNostrProviders(): NostrProviderOption[] {
  return getSignerOptions().filter((option) => option.isAvailable);
}

export function getSignerUnavailableReason(provider: NostrProviderId): string | null {
  const match = getSignerOptions().find((option) => option.id === provider);
  return match?.unavailableReason ?? null;
}

// Check if NIP-07 extension is available
export function hasNip07Extension(): boolean {
  return getAvailableNostrProviders().length > 0;
}

export function getNostrProvider(provider: NostrProviderId): Nip07Nostr | null {
  const option = getSignerOptions().find((opt) => opt.id === provider);
  return option?.isAvailable ? option.provider : null;
}

// Wait for selected extension provider to become available
export async function waitForNip07Extension(
  provider: NostrProviderId = 'alby',
  attempts = NIP07_RETRY_ATTEMPTS,
  delayMs = NIP07_RETRY_DELAY_MS
): Promise<Nip07Nostr | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const selected = getNostrProvider(provider);
    if (selected) {
      return selected;
    }
    await sleep(delayMs);
  }

  return null;
}

// Get NIP-07 extension
export function getNip07(provider: NostrProviderId = 'alby'): Nip07Nostr | null {
  return getNostrProvider(provider);
}

export function mapNip07Error(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');
  const normalized = message.toLowerCase();

  if (normalized.includes('denied') || normalized.includes('rejected') || normalized.includes('user canceled')) {
    return 'Please approve the connection request';
  }

  if (normalized.includes('not installed') || normalized.includes('window.nostr') || normalized.includes('undefined')) {
    return 'Please install a Nostr extension (Alby, nos2x)';
  }

  return message;
}

function missingProviderMessage(provider: NostrProviderId): string {
  if (provider === 'nostrcast') {
    return 'NostrCast Keychain was selected, but window.nostrKeychain is not available. Please unlock/install NostrCast Keychain or choose another signer.';
  }

  if (provider === 'nos2x') {
    return 'nos2x was selected, but no compatible nos2x provider is available. Please unlock nos2x or choose another signer.';
  }

  if (provider === 'window_nostr') {
    return 'Browser NIP-07 signer was selected, but window.nostr is not available. Please unlock/install a compatible signer or choose another provider.';
  }

  return 'Alby was selected, but window.nostr is not available. Please unlock/install Alby or choose another signer.';
}

// Get public key from selected NIP-07 provider
export async function getPublicKey(provider: NostrProviderId = 'alby'): Promise<string | null> {
  const nostr = await waitForNip07Extension(provider);
  if (!nostr) {
    markProviderUsage(`getPublicKey:${provider}:provider:none`);
    throw new Error(missingProviderMessage(provider));
  }

  try {
    markProviderUsage(`getPublicKey:${provider}:provider:${provider}`);
    const pubkey = await nostr.getPublicKey();
    if (!pubkey) {
      throw new Error('Extension returned an empty public key. Please unlock/authorize your Nostr extension and try again.');
    }
    return pubkey;
  } catch (error) {
    console.error('Failed to get public key:', error);
    throw new Error(mapNip07Error(error));
  }
}

// Create an unsigned event for signing
export function createUnsignedEvent(
  kind: number,
  content: string,
  tags: string[][],
  pubkey: string
): Omit<NostrEvent, 'id' | 'sig'> {
  return {
    kind,
    content,
    tags,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
  };
}

// Sign event with selected NIP-07 extension
export async function signEvent(
  event: Omit<NostrEvent, 'id' | 'sig'>,
  provider: NostrProviderId = 'alby'
): Promise<NostrEvent | null> {
  const nostr = await waitForNip07Extension(provider);
  if (!nostr) {
    markProviderUsage(`signEvent:${provider}:provider:none`);
    throw new Error(missingProviderMessage(provider));
  }

  const normalizeSignedEvent = (raw: any): NostrEvent => ({
    id: raw?.id,
    pubkey: raw?.pubkey,
    created_at: raw?.created_at ?? raw?.createdAt,
    kind: raw?.kind,
    tags: raw?.tags,
    content: raw?.content ?? '',
    sig: raw?.sig,
  });

  const isHex = (v: unknown, len: number) => typeof v === 'string' && new RegExp(`^[a-f0-9]{${len}}$`, 'i').test(v);

  try {
    markProviderUsage(`signEvent:${provider}:provider:${provider}`);
    const signed = await nostr.signEvent(event);
    const normalized = normalizeSignedEvent(signed);

    if (
      !isHex(normalized.id, 64) ||
      !isHex(normalized.pubkey, 64) ||
      !isHex(normalized.sig, 128) ||
      typeof normalized.kind !== 'number' ||
      typeof normalized.created_at !== 'number' ||
      !Array.isArray(normalized.tags)
    ) {
      throw new Error('Malformed signed event from extension');
    }

    return normalized;
  } catch (error) {
    console.error('Failed to sign event:', error);
    const mapped = mapNip07Error(error);
    if (mapped.toLowerCase().includes('malformed signed event') || String(error).toLowerCase().includes('malformed')) {
      throw new Error('Your selected Nostr signer returned an invalid auth signature. Try another signer and retry.');
    }
    throw new Error(mapped);
  }
}

// Sign event with private key (nsec/hex)
export function signEventWithPrivateKey(
  event: Omit<NostrEvent, 'id' | 'sig'>,
  privateKey: string
): NostrEvent {
  const privateKeyBytes = Uint8Array.from(
    privateKey.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );

  if (privateKeyBytes.length !== 32) {
    throw new Error('Invalid private key format');
  }

  return finalizeEvent(event, privateKeyBytes) as NostrEvent;
}

// Create auth challenge event (kind 22242)
export function createAuthChallengeEvent(
  pubkey: string,
  challenge: string,
  relayUrl?: string
): Omit<NostrEvent, 'id' | 'sig'> {
  const tags: string[][] = [['challenge', challenge]];
  if (relayUrl) {
    tags.push(['relay', relayUrl]);
  }

  return createUnsignedEvent(22242, '', tags, pubkey);
}

// Create NIP-98 HTTP auth event
export async function createNip98Event(
  pubkey: string,
  url: string,
  method: string,
  payload?: string
): Promise<Omit<NostrEvent, 'id' | 'sig'>> {
  const tags: string[][] = [
    ['u', url],
    ['method', method.toUpperCase()],
  ];

  if (payload) {
    const hash = await sha256(payload);
    tags.push(['payload', hash]);
  }

  return createUnsignedEvent(27235, '', tags, pubkey);
}

// SHA256 helper
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Encode pubkey to npub
export function encodeNpub(pubkey: string): string {
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return pubkey;
  }
}

// Decode npub to pubkey
export function decodeNpub(npub: string): string | null {
  try {
    const { type, data } = nip19.decode(npub);
    if (type === 'npub') {
      return data as string;
    }
    return null;
  } catch {
    return null;
  }
}

// Truncate npub for display
export function truncateNpub(npub: string, chars = 8): string {
  if (npub.length <= chars * 2 + 3) return npub;
  return `${npub.slice(0, chars)}...${npub.slice(-chars)}`;
}

// Fetch profile from relays
export async function fetchProfile(
  pubkey: string,
  relays: string[] = [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.primal.net',
  ]
): Promise<NostrProfile | null> {
  return fetchProfileCached(pubkey, relays);
}

// Create profile event (kind 0)
export function createProfileEvent(
  pubkey: string,
  profile: NostrProfile
): Omit<NostrEvent, 'id' | 'sig'> {
  return createUnsignedEvent(0, JSON.stringify(profile), [], pubkey);
}

// Publish event to relays
export async function publishEvent(
  event: NostrEvent,
  relays: string[] = [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
  ]
): Promise<{ success: boolean; relays: string[] }> {
  const pool = new SimplePool();
  const successRelays: string[] = [];

  try {
    const promises = relays.map(async (relay) => {
      try {
        await pool.publish([relay], event);
        successRelays.push(relay);
      } catch (error) {
        console.error(`Failed to publish to ${relay}:`, error);
      }
    });

    await Promise.allSettled(promises);

    return {
      success: successRelays.length > 0,
      relays: successRelays,
    };
  } finally {
    pool.close(relays);
  }
}

// Parse nsec (private key)
export function parseNsec(nsec: string): string | null {
  try {
    if (nsec.startsWith('nsec')) {
      const { type, data } = nip19.decode(nsec);
      if (type === 'nsec') {
        // data is Uint8Array, convert to hex
        const bytes = data as Uint8Array;
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    }
    // Check if it's a hex private key (64 chars)
    if (/^[a-f0-9]{64}$/i.test(nsec)) {
      return nsec;
    }
    return null;
  } catch {
    return null;
  }
}

// Derive pubkey from private key
export async function derivePubkey(privateKey: string): Promise<string | null> {
  try {
    const { secp256k1 } = await import('@noble/curves/secp256k1');
    const pubkeyBytes = secp256k1.getPublicKey(privateKey, true);
    // Convert Uint8Array to hex string and remove prefix
    const hexString = Array.from(pubkeyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return hexString.slice(2); // Remove 02/03 prefix
  } catch {
    return null;
  }
}
