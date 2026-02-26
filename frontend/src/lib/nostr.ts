import { nip19, SimplePool, finalizeEvent } from 'nostr-tools';
import type { NostrEvent, NostrProfile, Nip07Nostr } from '../types';

const NIP07_RETRY_ATTEMPTS = 10;
const NIP07_RETRY_DELAY_MS = 250;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// Check if NIP-07 extension is available
export function hasNip07Extension(): boolean {
  return typeof window !== 'undefined' && typeof window.nostr !== 'undefined';
}

// Wait for NIP-07 extension to become available
export async function waitForNip07Extension(
  attempts = NIP07_RETRY_ATTEMPTS,
  delayMs = NIP07_RETRY_DELAY_MS
): Promise<Nip07Nostr | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (window.nostr) {
      return window.nostr;
    }
    await sleep(delayMs);
  }

  return null;
}

// Get NIP-07 extension
export function getNip07(): Nip07Nostr | null {
  if (typeof window === 'undefined') return null;
  return window.nostr || null;
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

// Get public key from NIP-07 extension
export async function getPublicKey(): Promise<string | null> {
  const nostr = await waitForNip07Extension();
  if (!nostr) {
    throw new Error('Please install a Nostr extension (Alby, nos2x)');
  }

  try {
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

// Sign event with NIP-07 extension
export async function signEvent(
  event: Omit<NostrEvent, 'id' | 'sig'>
): Promise<NostrEvent | null> {
  const nostr = await waitForNip07Extension();
  if (!nostr) {
    throw new Error('Please install a Nostr extension (Alby, nos2x)');
  }

  try {
    return await nostr.signEvent(event);
  } catch (error) {
    console.error('Failed to sign event:', error);
    throw new Error(mapNip07Error(error));
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
  ]
): Promise<NostrProfile | null> {
  const pool = new SimplePool();

  try {
    const event = await pool.get(relays, {
      kinds: [0],
      authors: [pubkey],
    });

    if (event) {
      try {
        return JSON.parse(event.content) as NostrProfile;
      } catch {
        return null;
      }
    }

    return null;
  } finally {
    pool.close(relays);
  }
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
