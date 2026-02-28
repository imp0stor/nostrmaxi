export interface ProfileSuggestion {
  pubkey: string;
  name: string;
  nip05?: string;
  avatar: string;
  bio: string;
  followerCount: number;
  wotScore: number;
}

export interface FollowCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  profiles: ProfileSuggestion[];
}

const PROFILES: Record<string, ProfileSuggestion> = {
  lyn: {
    pubkey: 'f3f5c3ab21d4b6b0896f7c1d01e9657e5bf2dbd6f9a1f2cc0f8d8dbf20aabb11',
    name: 'Lyn Alden',
    nip05: 'lyn@nostr.example',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300',
    bio: 'Macro analyst writing about Bitcoin and monetary systems.',
    followerCount: 134000,
    wotScore: 98,
  },
  odell: {
    pubkey: '80f0cc6f85f2cb6ccf52b2c66f52bdb6d2d07f8a3e72bb6cf7e46a7b6f36a100',
    name: 'Matt Odell',
    nip05: 'odell@nostr.example',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300',
    bio: 'Bitcoin privacy educator and Rabbit Hole Recap host.',
    followerCount: 92000,
    wotScore: 95,
  },
  jack: {
    pubkey: '9ec7f5f5714f7fcb88b33920d1d7fbf1d4423c5a110ec8c6f7a8969e31e5ed10',
    name: 'jack',
    nip05: 'jack@nostr.example',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300',
    bio: 'Protocol-first social systems and open internet advocate.',
    followerCount: 540000,
    wotScore: 99,
  },
  fiatjaf: {
    pubkey: '3f770d65d6f66b5d2a1618e7ef9b03f31c34a8177f4f5eced2ac4fbf1d12aa35',
    name: 'fiatjaf',
    nip05: 'fiatjaf@nostr.example',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300',
    bio: 'Nostr protocol contributor and relay hacker.',
    followerCount: 73000,
    wotScore: 96,
  },
  mother: {
    pubkey: '6d0c8221842a119dfbf0f11b24e4dbf8f0e7a6f8d12bcf59bf8c8f13047aa341',
    name: 'Mother Nostr',
    nip05: 'mother@nostr.example',
    avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=300',
    bio: 'Art, culture, and open creator economies.',
    followerCount: 51000,
    wotScore: 90,
  },
  seedor: {
    pubkey: '1545de89128ce48111c9baf6a8013991f7bba4f74d2a57af9b9f2e3d4d67cc10',
    name: 'SEEDOR',
    nip05: 'seedor@nostr.example',
    avatar: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300',
    bio: 'Nostr artist sharing generative and hand-drawn work.',
    followerCount: 29000,
    wotScore: 87,
  },
  mill: {
    pubkey: '88d5377216d68913f9f13b4a6f284a56fbf037e7a2c93ad9c5f8ed736544d120',
    name: 'Milla Music',
    nip05: 'milla@nostr.example',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300',
    bio: 'Indie artist dropping unreleased demos and tour clips.',
    followerCount: 37000,
    wotScore: 85,
  },
  citadel: {
    pubkey: '2a2a4567c364f5a88db01b6a7a5cc497f6f2ea5f2b8b2fd5525d77bc0f490041',
    name: 'Citadel Dispatch',
    nip05: 'dispatch@nostr.example',
    avatar: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=300',
    bio: 'Daily Bitcoin and freedom tech news digest.',
    followerCount: 68000,
    wotScore: 93,
  },
  sports: {
    pubkey: 'a3c909f6dbf56eb00cc7706a08a7d2e4ce2d8de8e2ef127f5cb0be5d622cb120',
    name: 'Sports Relay Room',
    nip05: 'sports@nostr.example',
    avatar: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=300',
    bio: 'Live scores and commentary from decentralized sports pods.',
    followerCount: 44000,
    wotScore: 82,
  },
  gamer: {
    pubkey: 'b53ddf25dd1a98facc8c77450b1d68fc14d562f7db220de83442de2c53e9aa31',
    name: 'Nostr Gamer HQ',
    nip05: 'gaming@nostr.example',
    avatar: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=300',
    bio: 'Gaming clips, strategy threads, and eSports highlights.',
    followerCount: 47000,
    wotScore: 84,
  },
};

export const ONBOARDING_FOLLOW_CATEGORIES: FollowCategory[] = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    icon: '₿',
    description: 'Monetary policy, sovereignty, and builders in Bitcoin.',
    profiles: [PROFILES.lyn, PROFILES.odell, PROFILES.citadel],
  },
  {
    id: 'tech',
    name: 'Tech & Dev',
    icon: '💻',
    description: 'Protocol devs, app builders, and open-source maintainers.',
    profiles: [PROFILES.jack, PROFILES.fiatjaf],
  },
  {
    id: 'art',
    name: 'Art',
    icon: '🎨',
    description: 'Creators sharing visual experiments and design inspiration.',
    profiles: [PROFILES.mother, PROFILES.seedor],
  },
  {
    id: 'music',
    name: 'Music',
    icon: '🎵',
    description: 'Artists, producers, and fans sharing tracks and commentary.',
    profiles: [PROFILES.milla, PROFILES.mother],
  },
  {
    id: 'news',
    name: 'News',
    icon: '📰',
    description: 'Fast-moving updates from trusted Nostr-native voices.',
    profiles: [PROFILES.citadel, PROFILES.jack],
  },
  {
    id: 'sports',
    name: 'Sports',
    icon: '🏈',
    description: 'Scores, clips, and fan threads in decentralized communities.',
    profiles: [PROFILES.sports],
  },
  {
    id: 'gaming',
    name: 'Gaming',
    icon: '🎮',
    description: 'Gaming creators and competitive scenes on Nostr.',
    profiles: [PROFILES.gamer],
  },
];
