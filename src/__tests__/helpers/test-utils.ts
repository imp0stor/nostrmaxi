/**
 * Test utilities and helpers
 */
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import * as crypto from 'crypto';

/**
 * Generate a test Nostr keypair
 */
export function generateTestKeypair() {
  const secretKey = generateSecretKey();
  const publicKey = getPublicKey(secretKey);
  
  return {
    secretKey,
    publicKey,
    privkey: Buffer.from(secretKey).toString('hex'),
    pubkey: publicKey,
  };
}

/**
 * Create a signed Nostr event
 */
export function createSignedEvent(
  kind: number,
  content: string,
  tags: string[][],
  secretKey: Uint8Array,
) {
  const event = {
    kind,
    content,
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };
  
  return finalizeEvent(event, secretKey);
}

/**
 * Create a NIP-98 auth header
 */
export function createNip98AuthHeader(
  method: string,
  url: string,
  secretKey: Uint8Array,
): string {
  const event = createSignedEvent(
    27235, // NIP-98 kind
    '',
    [
      ['u', url],
      ['method', method.toUpperCase()],
    ],
    secretKey,
  );
  
  const base64Event = Buffer.from(JSON.stringify(event)).toString('base64');
  return `Nostr ${base64Event}`;
}

/**
 * Create a NIP-42 auth challenge event
 */
export function createNip42AuthEvent(
  challenge: string,
  secretKey: Uint8Array,
) {
  return createSignedEvent(
    22242, // NIP-42 kind
    '',
    [['challenge', challenge]],
    secretKey,
  );
}

/**
 * Mock LNbits invoice response
 */
export function mockLnbitsInvoice(amountSats: number) {
  const paymentHash = crypto.randomBytes(32).toString('hex');
  
  return {
    payment_hash: paymentHash,
    payment_request: `lnbc${amountSats}n1mock${paymentHash.slice(0, 16)}`,
    checking_id: paymentHash,
  };
}

/**
 * Mock LNbits payment status response
 */
export function mockLnbitsStatus(paid: boolean) {
  return {
    paid,
    pending: !paid,
    details: {
      payment_hash: crypto.randomBytes(32).toString('hex'),
      preimage: paid ? crypto.randomBytes(32).toString('hex') : undefined,
    },
  };
}

/**
 * Sleep for testing async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random email-like string
 */
export function randomEmail(): string {
  const random = crypto.randomBytes(8).toString('hex');
  return `test-${random}@example.com`;
}

/**
 * Generate a random hex string
 */
export function randomHex(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
