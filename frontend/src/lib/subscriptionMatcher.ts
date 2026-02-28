import type { Event as NostrEvent } from 'nostr-tools';
import type {
  NotificationPreferences,
  NotificationTrigger,
  TopicSubscriptions,
  UserSubscriptions,
} from './subscriptionLists';

export interface SubscriptionMatcherInput {
  topicSubscriptions: TopicSubscriptions;
  userSubscriptions: UserSubscriptions;
  notificationPrefs: NotificationPreferences;
}

function extractHashtags(event: Pick<NostrEvent, 'content' | 'tags'>): string[] {
  const fromTags = (event.tags || []).filter((t) => t[0] === 't' && t[1]).map((t) => t[1].toLowerCase());
  const fromContent = Array.from((event.content || '').matchAll(/#([a-z0-9_]+)/gi)).map((m) => m[1].toLowerCase());
  return [...new Set([...fromTags, ...fromContent])];
}

function inQuietHours(prefs: NotificationPreferences, now = new Date()): boolean {
  if (!prefs.quietHours.enabled) return false;
  const parse = (value: string) => {
    const [h, m] = value.split(':').map((v) => Number(v));
    return (h * 60) + (m || 0);
  };
  const start = parse(prefs.quietHours.start);
  const end = parse(prefs.quietHours.end);
  const current = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function shouldNotify(
  event: Pick<NostrEvent, 'id' | 'pubkey' | 'kind' | 'content' | 'tags'>,
  input: SubscriptionMatcherInput,
): NotificationTrigger<typeof event> | null {
  const { topicSubscriptions, userSubscriptions, notificationPrefs } = input;

  if (notificationPrefs.mutedNotifications.includes(event.pubkey)) return null;

  const watchedUser = userSubscriptions.users.find((user) => user.pubkey === event.pubkey);
  if (watchedUser) {
    const isReply = (event.tags || []).some((t) => t[0] === 'e' && Boolean(t[1]));
    if (!isReply && watchedUser.notifyOnPost) return { type: 'user', match: event.pubkey, event };
    if (isReply && watchedUser.notifyOnReply) return { type: 'user', match: event.pubkey, event };
  }

  const hashtags = extractHashtags(event);
  const topicMatch = hashtags.find((tag) => topicSubscriptions.hashtags.map((x) => x.toLowerCase().replace(/^#/, '')).includes(tag));
  if (topicMatch) return { type: 'topic', match: topicMatch, event };

  const lowerContent = (event.content || '').toLowerCase();
  const keywordMatch = topicSubscriptions.keywords.find((keyword) => lowerContent.includes(keyword.toLowerCase()));
  if (keywordMatch) return { type: 'keyword', match: keywordMatch, event };

  return null;
}

export function shouldPlaySound(notificationPrefs: NotificationPreferences): boolean {
  return !inQuietHours(notificationPrefs);
}
