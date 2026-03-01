// Nostr types
export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

// NIP-07 window.nostr interface
export interface Nip07Nostr {
  getPublicKey(): Promise<string>;
  signEvent(event: Omit<NostrEvent, 'id' | 'sig'>): Promise<NostrEvent>;
  getRelays?(): Promise<Record<string, { read: boolean; write: boolean }>>;
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
  nip44?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}

declare global {
  interface Window {
    nostr?: Nip07Nostr;
    nostrKeychain?: Nip07Nostr;
    nos2x?: { nostr?: Nip07Nostr };
    alby?: { nostr?: Nip07Nostr };
  }
}

// User types
export interface User {
  pubkey: string;
  npub: string;
  tier: SubscriptionTier;
  nip05s: Nip05[];
  wotScore: number;
  subscription?: {
    tier: SubscriptionTier;
    expiresAt: string | null;
    isActive: boolean;
  };
}

export interface Nip05 {
  id: string;
  localPart: string;
  domain: string;
  isActive: boolean;
}

// Subscription types
export type SubscriptionTier = 'FREE' | 'PRO' | 'BUSINESS' | 'LIFETIME';
export type BillingCycle = 'monthly' | 'annual' | 'lifetime';

export type BlossomPolicyMode = 'external-default' | 'managed-paid';

export interface TierInfo {
  tier: SubscriptionTier;
  name: string;
  description: string;
  priceUsd: number;
  priceSats: number;
  features: string[];
  nip05Limit: number;
  customDomain: boolean;
  analytics: boolean;
  apiAccess: boolean;
  blossomPolicy?: BlossomPolicyMode;
  blossomStorageMb?: number;
  isLifetime?: boolean;
}

export interface Subscription {
  tier: SubscriptionTier;
  tierInfo: TierInfo;
  nip05Count: number;
  nip05Limit: number;
  nip05Remaining: number;
  expiresAt: string | null;
  isActive: boolean;
  isCancelled: boolean;
  daysRemaining: number | null;
  wotDiscount: number;
  recentPayments: PaymentSummary[];
}

export interface DomainCatalogEntry {
  domain: string;
  label?: string;
  category?: string;
}

export interface DomainCatalogResponse {
  defaultDomain: string;
  domains: DomainCatalogEntry[];
}

// Payment types
export interface PaymentSummary {
  id: string;
  amountSats: number | null;
  receiptNumber: string | null;
  paidAt: string | null;
}

export interface PaymentInvoice {
  paymentId: string;
  invoice: string;
  paymentHash: string;
  amountSats: number;
  amountUsd: number;
  discountPercent: number;
  expiresAt: number;
  billingCycle?: BillingCycle;
}

export interface PaymentStatus {
  status: 'pending' | 'paid' | 'expired' | 'failed';
  paid: boolean;
  paidAt?: string;
  tier?: string;
  expiresAt?: string;
}

export interface Receipt {
  receiptNumber: string;
  date: string;
  item: string;
  description: string;
  amountSats: number | null;
  amountUsd: number | null;
  paymentMethod: string;
  paymentHash: string | null;
  customer: {
    npub: string;
  };
}

// API Key types
export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  key?: string; // Only returned on creation
  permissions: string[];
  rateLimit: number;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface ApiKeyUsage {
  keyId: string;
  name: string;
  rateLimit: number;
  hourlyUsage: number;
  dailyUsage: number;
  remainingHourly: number;
  recentRequests: {
    endpoint: string;
    method: string;
    statusCode: number;
    timestamp: string;
  }[];
  endpointBreakdown: {
    endpoint: string;
    count: number;
  }[];
}

// Auth types
export interface AuthChallenge {
  challenge: string;
  expiresAt: number;
}

export interface LnurlAuth {
  lnurl: string;
  k1: string;
  expiresAt: number;
}

export interface AuthResponse {
  token: string;
  user: User;
  expiresAt: number;
}

export type NotificationType = 'system' | 'mention' | 'reply' | 'zap' | 'follow';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
  link?: string;
}

// Nostr profile (kind 0)
export interface NostrProfile {
  name?: string;
  display_name?: string;
  picture?: string;
  banner?: string;
  about?: string;
  website?: string;
  lud16?: string;
  nip05?: string;
}
