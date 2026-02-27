import type { DiscoverUser } from './social';

export type DiscoverMode = 'for-you' | 'wot' | 'general' | 'following';

export function excludeFollowedDiscoverUsers<T extends { pubkey: string }>(users: T[], following: string[]): T[] {
  if (following.length === 0) return users;
  const followingSet = new Set(following);
  return users.filter((user) => !followingSet.has(user.pubkey));
}

export function optimisticFollowUpdate<T extends { pubkey: string }>(users: T[], followedPubkey: string): T[] {
  return users.filter((user) => user.pubkey !== followedPubkey);
}

function coalesceNumber(...values: Array<number | null | undefined>): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  }
  return 0;
}

export function hydrateFollowerCount(user: DiscoverUser): DiscoverUser {
  const followers = coalesceNumber((user as any).follower_count, (user as any).followers_count, (user as any).followerCount, user.followers);
  const following = coalesceNumber((user as any).following_count, (user as any).followings_count, (user as any).followingCount, (user as any).followings, user.following);
  return {
    ...user,
    followers,
    following,
  };
}

export function sortDiscoverUsers<T extends DiscoverUser>(users: T[], mode: DiscoverMode): T[] {
  const out = [...users];
  switch (mode) {
    case 'for-you':
      out.sort((a, b) => (b.forYouScore ?? b.score) - (a.forYouScore ?? a.score) || b.activity - a.activity || b.followers - a.followers);
      return out;
    case 'wot':
      out.sort((a, b) => (b.wotScore ?? b.score) - (a.wotScore ?? a.score) || b.overlapScore - a.overlapScore || b.relayAffinityScore - a.relayAffinityScore);
      return out;
    case 'following':
      out.sort((a, b) => a.pubkey.localeCompare(b.pubkey));
      return out;
    case 'general':
    default:
      out.sort((a, b) => b.followers - a.followers || b.activity - a.activity || b.score - a.score);
      return out;
  }
}

export function discoverSortLabel(mode: DiscoverMode): string {
  if (mode === 'for-you') return 'Mode: For You · Secondary: Activity + Followers';
  if (mode === 'wot') return 'Mode: WoT · Secondary: Overlap + Relay Affinity';
  if (mode === 'following') return 'Mode: Following · Secondary: Pubkey';
  return 'Mode: General · Secondary: Followers + Activity';
}
