import { Injectable } from '@nestjs/common';
import type { Event as NostrEvent } from 'nostr-tools';

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

export interface UserSubscriptionsEnvelope {
  topicSubscriptions: TopicSubscriptions;
  userSubscriptions: UserSubscriptions;
  notificationPrefs: NotificationPreferences;
}

export interface NotificationTrigger {
  type: 'topic' | 'keyword' | 'user';
  match: string;
  event: Pick<NostrEvent, 'id' | 'pubkey' | 'kind' | 'content' | 'tags'>;
}

@Injectable()
export class SubscriptionMatcherService {
  shouldNotify(
    event: Pick<NostrEvent, 'id' | 'pubkey' | 'kind' | 'content' | 'tags'>,
    subscriptions: UserSubscriptionsEnvelope,
  ): NotificationTrigger | null {
    const normalized = this.normalize(subscriptions);

    if (normalized.notificationPrefs.mutedNotifications.includes(event.pubkey)) return null;

    const watched = normalized.userSubscriptions.users.find((user) => user.pubkey === event.pubkey);
    if (watched) {
      const isReply = (event.tags || []).some((t) => t[0] === 'e' && t[1]);
      if (!isReply && watched.notifyOnPost) return { type: 'user', match: event.pubkey, event };
      if (isReply && watched.notifyOnReply) return { type: 'user', match: event.pubkey, event };
      if (event.kind === 9735 && watched.notifyOnZap) return { type: 'user', match: event.pubkey, event };
    }

    const hashtags = this.extractHashtags(event);
    const topic = hashtags.find((tag) => normalized.topicSubscriptions.hashtags.includes(tag));
    if (topic) return { type: 'topic', match: topic, event };

    const lowerContent = (event.content || '').toLowerCase();
    const keyword = normalized.topicSubscriptions.keywords.find((word) => lowerContent.includes(word));
    if (keyword) return { type: 'keyword', match: keyword, event };

    return null;
  }

  shouldPlaySound(notificationPrefs: NotificationPreferences, now = new Date()): boolean {
    return !this.isQuietHours(notificationPrefs, now);
  }

  shouldSendZapNotification(notificationPrefs: NotificationPreferences, amountSat: number): boolean {
    return amountSat >= Math.max(0, Number(notificationPrefs.minZapAmount || 0));
  }

  private extractHashtags(event: Pick<NostrEvent, 'content' | 'tags'>): string[] {
    const fromTags = (event.tags || []).filter((t) => t[0] === 't' && t[1]).map((t) => t[1].toLowerCase());
    const fromContent = Array.from((event.content || '').matchAll(/#([a-z0-9_]+)/gi)).map((m) => m[1].toLowerCase());
    return [...new Set([...fromTags, ...fromContent])];
  }

  private isQuietHours(notificationPrefs: NotificationPreferences, now: Date): boolean {
    if (!notificationPrefs.quietHours.enabled) return false;

    const toMinutes = (value: string): number => {
      const [h, m] = value.split(':').map((v) => Number(v));
      return (h * 60) + (m || 0);
    };

    const current = now.getHours() * 60 + now.getMinutes();
    const start = toMinutes(notificationPrefs.quietHours.start);
    const end = toMinutes(notificationPrefs.quietHours.end);

    if (start === end) return true;
    if (start < end) return current >= start && current < end;
    return current >= start || current < end;
  }

  private normalize(input: UserSubscriptionsEnvelope): UserSubscriptionsEnvelope {
    const uniq = (values: string[]) => [...new Set((values || []).map((v) => v.trim()).filter(Boolean))];
    return {
      topicSubscriptions: {
        hashtags: uniq(input.topicSubscriptions?.hashtags || []).map((v) => v.replace(/^#/, '').toLowerCase()),
        keywords: uniq(input.topicSubscriptions?.keywords || []).map((v) => v.toLowerCase()),
      },
      userSubscriptions: {
        users: (input.userSubscriptions?.users || []).map((u) => ({
          pubkey: (u.pubkey || '').trim(),
          notifyOnPost: Boolean(u.notifyOnPost),
          notifyOnReply: Boolean(u.notifyOnReply),
          notifyOnZap: Boolean(u.notifyOnZap),
        })).filter((u) => Boolean(u.pubkey)),
      },
      notificationPrefs: {
        mentions: input.notificationPrefs?.mentions ?? true,
        replies: input.notificationPrefs?.replies ?? true,
        reposts: input.notificationPrefs?.reposts ?? true,
        zaps: input.notificationPrefs?.zaps ?? true,
        follows: input.notificationPrefs?.follows ?? true,
        quietHours: {
          enabled: input.notificationPrefs?.quietHours?.enabled ?? false,
          start: input.notificationPrefs?.quietHours?.start || '22:00',
          end: input.notificationPrefs?.quietHours?.end || '08:00',
          timezone: input.notificationPrefs?.quietHours?.timezone || 'UTC',
        },
        mutedNotifications: uniq(input.notificationPrefs?.mutedNotifications || []),
        minZapAmount: Number(input.notificationPrefs?.minZapAmount || 0),
      },
    };
  }
}
