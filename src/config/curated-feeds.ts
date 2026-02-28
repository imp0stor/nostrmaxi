export interface CuratedFeed {
  id: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  samplePosts: Array<{
    id: string;
    pubkey: string;
    content: string;
    createdAt: number;
  }>;
  subscriberCount: number;
}

export const CURATED_FEEDS: CuratedFeed[] = [
  {
    id: 'bitcoin-news',
    name: 'Bitcoin News',
    description: 'High-signal updates from Bitcoin builders, analysts, and educators.',
    config: {
      categories: ['bitcoin', 'macro', 'mining'],
      minWotScore: 75,
      sort: 'recent_hot',
    },
    samplePosts: [
      {
        id: 'evt-btc-1',
        pubkey: 'f3f5c3ab21d4b6b0896f7c1d01e9657e5bf2dbd6f9a1f2cc0f8d8dbf20aabb11',
        content: 'Mempool pressure is dropping while long-term holder supply keeps climbing. Quietly bullish.',
        createdAt: 1709076600,
      },
      {
        id: 'evt-btc-2',
        pubkey: '80f0cc6f85f2cb6ccf52b2c66f52bdb6d2d07f8a3e72bb6cf7e46a7b6f36a100',
        content: 'Reminder: run your own node, verify your own TXs, and rotate your relay set quarterly.',
        createdAt: 1709077400,
      },
    ],
    subscriberCount: 24812,
  },
  {
    id: 'art-photography',
    name: 'Art & Photography',
    description: 'A visual feed of original art, photos, and creative process notes.',
    config: {
      categories: ['art', 'photography', 'design'],
      includeMediaOnly: true,
      minWotScore: 60,
    },
    samplePosts: [
      {
        id: 'evt-art-1',
        pubkey: '6d0c8221842a119dfbf0f11b24e4dbf8f0e7a6f8d12bcf59bf8c8f13047aa341',
        content: 'New triptych inspired by relay topology maps. Process thread below 👇',
        createdAt: 1709075100,
      },
    ],
    subscriberCount: 17405,
  },
  {
    id: 'tech-dev',
    name: 'Tech & Dev',
    description: 'Nostr protocol development, app architecture, and engineering discussions.',
    config: {
      categories: ['tech', 'dev', 'oss'],
      minWotScore: 70,
      includeReplies: false,
    },
    samplePosts: [
      {
        id: 'evt-dev-1',
        pubkey: '3f770d65d6f66b5d2a1618e7ef9b03f31c34a8177f4f5eced2ac4fbf1d12aa35',
        content: 'NIP draft update: list sync can use replaceable events with deterministic d-tags.',
        createdAt: 1709073000,
      },
    ],
    subscriberCount: 19877,
  },
  {
    id: 'memes-fun',
    name: 'Memes & Fun',
    description: 'Lightweight humor and entertaining posts from trusted circles.',
    config: {
      categories: ['memes', 'fun', 'culture'],
      minWotScore: 40,
      maxPostsPerAuthorPerDay: 5,
    },
    samplePosts: [
      {
        id: 'evt-meme-1',
        pubkey: 'b53ddf25dd1a98facc8c77450b1d68fc14d562f7db220de83442de2c53e9aa31',
        content: 'When your relay is green across uptime, latency, and sync depth 😎',
        createdAt: 1709079400,
      },
    ],
    subscriberCount: 30112,
  },
];
