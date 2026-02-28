export const SYNC_CONFIG = {
  // Company pubkeys for WoT priority
  companyPubkeys: [] as string[],

  // Owner pubkey
  ownerPubkey: process.env.OWNER_PUBKEY || '',

  // Retention periods
  temporaryRetentionDays: 30,
  bestEffortRetentionDays: 90,

  // Storage thresholds
  storageWarningPercent: 80,
  storageCriticalPercent: 95,

  // Noise thresholds
  minFollowersForSync: 1, // 0 followers = likely bot
  minWotScoreForSync: 0.1,
  spamConfidenceThreshold: 0.7,

  // WoT depth
  maxWotHops: 2, // How many hops for tangential
};
