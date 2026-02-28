export const SUBSCRIPTION_LIST_KIND = 30001;

export const LIST_D_TAGS = {
  FEED_SUBSCRIPTIONS: 'feed-subscriptions',
  TOPIC_SUBSCRIPTIONS: 'topic-subscriptions',
  USER_SUBSCRIPTIONS: 'user-subscriptions',
  NOTIFICATION_PREFS: 'notification-prefs',
  CUSTOM_FEEDS: 'custom-feeds',
} as const;

export interface FeedSubscriptions {
  feeds: {
    id: string;
    name: string;
    definition: string;
    enabled: boolean;
  }[];
}

export interface TopicSubscriptions {
  hashtags: string[];
  keywords: string[];
}

export interface UserSubscriptions {
  users: {
    pubkey: string;
    notifyOnPost: boolean;
    notifyOnReply: boolean;
    notifyOnZap: boolean;
  }[];
}

export interface NotificationPreferences {
  mentions: boolean;
  replies: boolean;
  reposts: boolean;
  zaps: boolean;
  follows: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
  mutedNotifications: string[];
  minZapAmount: number;
}

export const DEFAULT_FEED_SUBSCRIPTIONS: FeedSubscriptions = { feeds: [] };
export const DEFAULT_TOPIC_SUBSCRIPTIONS: TopicSubscriptions = { hashtags: [], keywords: [] };
export const DEFAULT_USER_SUBSCRIPTIONS: UserSubscriptions = { users: [] };
export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  mentions: true,
  replies: true,
  reposts: true,
  zaps: true,
  follows: true,
  quietHours: { enabled: false, start: '22:00', end: '08:00', timezone: 'UTC' },
  mutedNotifications: [],
  minZapAmount: 0,
};

export interface NotificationTrigger<TEvent = unknown> {
  type: 'topic' | 'keyword' | 'user';
  match: string;
  event: TEvent;
}
