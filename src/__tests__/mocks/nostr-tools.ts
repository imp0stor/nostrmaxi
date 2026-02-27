/**
 * Mock implementation of nostr-tools for testing
 */
import * as crypto from 'crypto';

// Mock Nostr event structure validation
export function validateEvent(event: any): boolean {
  return Boolean(
    event &&
    typeof event.kind === 'number' &&
    typeof event.created_at === 'number' &&
    typeof event.content === 'string' &&
    Array.isArray(event.tags) &&
    typeof event.pubkey === 'string'
  );
}

// Mock Nostr event verification using simple signature check
export function verifyEvent(event: any): boolean {
  // In tests, we trust all events (or validate structure only)
  if (!event.pubkey || !event.sig || !event.id) {
    return false;
  }
  // Simple validation: check event structure
  return true;
}

// Mock key generation
export function generateSecretKey(): Uint8Array {
  return new Uint8Array(crypto.randomBytes(32));
}

// Mock public key derivation
export function getPublicKey(secretKey: Uint8Array): string {
  // Generate deterministic pubkey from secret
  const hash = crypto.createHash('sha256').update(Buffer.from(secretKey)).digest();
  return hash.toString('hex');
}

// Mock event finalization (signing)
export function finalizeEvent(event: any, secretKey: Uint8Array): any {
  const pubkey = getPublicKey(secretKey);
  
  // Create event ID (hash of serialized event)
  const eventData = JSON.stringify([
    0,
    pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
  const id = crypto.createHash('sha256').update(eventData).digest('hex');
  
  // Create mock signature
  const sig = crypto.createHash('sha256').update(id + Buffer.from(secretKey).toString('hex')).digest('hex');
  
  return {
    ...event,
    id,
    pubkey,
    sig,
  };
}

// Mock nip19 encoding/decoding
export const nip19 = {
  npubEncode(pubkey: string): string {
    return `npub1${pubkey.slice(0, 58)}`;
  },
  
  npubDecode(npub: string): { type: string; data: string } {
    return {
      type: 'npub',
      data: npub.slice(5),
    };
  },
  
  nsecEncode(privkey: string): string {
    return `nsec1${privkey.slice(0, 58)}`;
  },
};

// Mock schnorr signature verification (used by LNURL-auth)
export const schnorr = {
  verify(signature: Buffer, message: Buffer, pubkey: Buffer): boolean {
    // In tests, accept all signatures
    return signature.length === 64 && pubkey.length === 32;
  },
};
