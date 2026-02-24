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
}

declare global {
  interface Window {
    nostr?: Nip07Nostr;
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

// Feed types
export interface FeedItem {
  id: string;
  kind: number;
  pubkey: string;
  createdAt: number;
  title?: string;
  summary?: string;
  content: string;
  tags: string[][];
  url?: string;
  image?: string;
  duration?: number; // For episodes
  wotScore?: number; // Trust score of author
  isLikelyBot?: boolean;
}

export interface FeedConfig {
  pubkey: string;
  contentTypes: string[]; // "episode", "show", "note", "product", "bounty", "qa"
  filterMode: 'wot' | 'genuine' | 'firehose'; // Web of Trust, genuine (low-bot), all
  wotDepth: number; // 1-5
  sortBy: 'newest' | 'oldest' | 'popular' | 'trending';
  limit: number;
  offset: number;
}

// Content types
export interface Show {
  id: string;
  title: string;
  description?: string;
  image?: string;
  author: string;
  pubkey: string;
  createdAt: number;
  updatedAt?: number;
  episodes?: Episode[];
}

export interface Episode {
  id: string;
  showId: string;
  title: string;
  description?: string;
  image?: string;
  duration: number;
  mediaUrl?: string;
  author: string;
  pubkey: string;
  createdAt: number;
  tags: string[][];
}

export interface ContentNote {
  id: string;
  title?: string;
  content: string;
  author: string;
  pubkey: string;
  createdAt: number;
  tags: string[][];
  image?: string;
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  image?: string;
  price: number;
  author: string;
  pubkey: string;
  createdAt: number;
  tags: string[][];
}

// WoT types
export interface WotScoreResult {
  pubkey: string;
  npub: string;
  score: number;
  isBot: boolean;
  trustLevel: 'high' | 'medium' | 'low' | 'unknown';
  connectionStrength: number;
}
