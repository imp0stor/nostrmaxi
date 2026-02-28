import type { Prisma } from '@prisma/client';

export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json' | 'array';

export interface DefaultConfigEntry {
  key: string;
  value: Prisma.JsonValue;
  type: ConfigValueType;
  category: string;
  description: string;
}

export const DEFAULT_CONFIG: DefaultConfigEntry[] = [
  {
    key: 'relays.fallback',
    category: 'relays',
    type: 'array',
    value: [
      'wss://10.1.10.143:3401/relay',
      'wss://relay.damus.io',
      'wss://relay.primal.net',
      'wss://relay.snort.social',
      'wss://nostr.wine',
      'wss://relay.momostr.pink',
      'wss://relay.ditto.pub',
      'wss://nostr.oxtr.dev',
    ],
    description: 'Fallback relays used when user relay list is missing/unavailable.',
  },
  {
    key: 'relays.discovery',
    category: 'relays',
    type: 'array',
    value: ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://relay.snort.social', 'wss://nostr.wine'],
    description: 'Seed relays used for relay-discovery and publishing relay-list updates.',
  },
  {
    key: 'relays.local',
    category: 'relays',
    type: 'string',
    value: 'wss://10.1.10.143:3401/relay',
    description: 'Primary local relay endpoint.',
  },
  {
    key: 'blossom.servers',
    category: 'blossom',
    type: 'json',
    value: [
      { url: 'https://blossom.primal.net', name: 'Primal', priority: 1, requiresAuth: false },
      { url: 'https://nostr.build', name: 'nostr.build', priority: 2, requiresAuth: false },
      { url: 'https://void.cat', name: 'void.cat', priority: 3, requiresAuth: false },
      { url: 'https://nostrimg.com', name: 'nostrimg', priority: 4, requiresAuth: false },
    ],
    description: 'Blossom-compatible media upload servers.',
  },
  {
    key: 'blossom.maxFileSize',
    category: 'blossom',
    type: 'number',
    value: 100000000,
    description: 'Maximum upload size in bytes for blossom media uploads.',
  },
  {
    key: 'features.analytics',
    category: 'features',
    type: 'boolean',
    value: true,
    description: 'Enable analytics pages and endpoints.',
  },
  {
    key: 'features.marketplace',
    category: 'features',
    type: 'boolean',
    value: true,
    description: 'Enable marketplace UI and API surfaces.',
  },
  {
    key: 'limits.maxRelays',
    category: 'limits',
    type: 'number',
    value: 10,
    description: 'Maximum relays considered in recommendation blends.',
  },
  {
    key: 'api.baseUrl',
    category: 'api',
    type: 'string',
    value: '/api/v1',
    description: 'Frontend API base URL path.',
  },
  {
    key: 'ui.discovery.defaultTab',
    category: 'ui',
    type: 'string',
    value: 'for-you',
    description: 'Default selected discovery tab.',
  },
];
