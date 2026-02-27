export interface DiscoverCardDataLike {
  pubkey: string;
  followers: number;
  following: number;
  activity: number;
  overlapScore: number;
  wotFollowerCount: number;
  score: number;
  verifiedNip05: boolean;
  name?: string;
  nip05?: string;
  about?: string;
  picture?: string;
}
