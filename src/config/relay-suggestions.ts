export interface RelaySuggestion {
  url: string;
  name: string;
  description: string;
  uptime: number;
  wotScore: number;
  region: string;
  type: 'free' | 'paid' | 'private';
  recommended: boolean;
}

export const RELAY_SUGGESTIONS: RelaySuggestion[] = [
  {
    url: 'wss://relay.damus.io',
    name: 'Damus Relay',
    description: 'High-availability global relay with excellent uptime.',
    uptime: 99.7,
    wotScore: 95,
    region: 'Global',
    type: 'free',
    recommended: true,
  },
  {
    url: 'wss://relay.primal.net',
    name: 'Primal Relay',
    description: 'Popular relay for social discovery and broad propagation.',
    uptime: 99.4,
    wotScore: 93,
    region: 'Global',
    type: 'free',
    recommended: true,
  },
  {
    url: 'wss://nos.lol',
    name: 'nos.lol',
    description: 'Fast relay used heavily by WoT-ranked accounts.',
    uptime: 98.8,
    wotScore: 90,
    region: 'US',
    type: 'free',
    recommended: true,
  },
  {
    url: 'wss://relay.nostr.band',
    name: 'nostr.band Relay',
    description: 'Great for search-indexed events and analytics coverage.',
    uptime: 98.6,
    wotScore: 88,
    region: 'EU',
    type: 'free',
    recommended: true,
  },
  {
    url: 'wss://relay.snort.social',
    name: 'Snort Relay',
    description: 'Reliable social relay with healthy event propagation.',
    uptime: 97.9,
    wotScore: 86,
    region: 'Global',
    type: 'free',
    recommended: false,
  },
  {
    url: 'wss://nostr.wine',
    name: 'Nostr.Wine',
    description: 'Community relay with support for rich media.',
    uptime: 97.5,
    wotScore: 84,
    region: 'EU',
    type: 'paid',
    recommended: false,
  },
  {
    url: 'wss://relay.nostr.bg',
    name: 'Nostr.BG',
    description: 'Strong APAC coverage and good regional latency.',
    uptime: 96.8,
    wotScore: 81,
    region: 'APAC',
    type: 'free',
    recommended: false,
  },
  {
    url: 'wss://private.nostrmaxi.com',
    name: 'NostrMaxi Private',
    description: 'Private relay optimized for premium onboarding users.',
    uptime: 99.9,
    wotScore: 89,
    region: 'US',
    type: 'private',
    recommended: false,
  },
];
