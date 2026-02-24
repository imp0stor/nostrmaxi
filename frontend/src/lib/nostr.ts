import { nip19, SimplePool } from 'nostr-tools';
import type { NostrEvent, NostrProfile, Nip07Nostr } from '../types';

// Check if NIP-07 extension is available
export function hasNip07Extension(): boolean {
  return typeof window !== 'undefined' && !!window.nostr;
}

// Get NIP-07 extension
export function getNip07(): Nip07Nostr | null {
  return window.nostr || null;
}

// Get public key from NIP-07 extension
export async function getPublicKey(): Promise<string | null> {
  const nostr = getNip07();
  if (!nostr) return null;

  try {
    return await nostr.getPublicKey();
  } catch (error) {
    console.error('Failed to get public key:', error);
    return null;
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
  const nostr = getNip07();
  if (!nostr) return null;

  try {
    return await nostr.signEvent(event);
  } catch (error) {
    console.error('Failed to sign event:', error);
    return null;
  }
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

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
