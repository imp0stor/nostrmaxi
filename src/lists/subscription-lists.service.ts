import { Injectable } from '@nestjs/common';
import type { Event as NostrEvent } from 'nostr-tools';

export const SUBSCRIPTION_LIST_KIND = 30001;

export const SUBSCRIPTION_D_TAGS = {
  FEED_SUBSCRIPTIONS: 'feed-subscriptions',
  TOPIC_SUBSCRIPTIONS: 'topic-subscriptions',
  USER_SUBSCRIPTIONS: 'user-subscriptions',
  NOTIFICATION_PREFS: 'notification-prefs',
} as const;

@Injectable()
export class SubscriptionListsService {
  createEncryptedListEvent(
    pubkey: string,
    dTag: string,
    encryptedContent: string,
  ): Omit<NostrEvent, 'id' | 'sig'> {
    return {
      kind: SUBSCRIPTION_LIST_KIND,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', dTag],
        ['encrypted', 'nip44'],
        ['client', 'nostrmaxi'],
      ],
      content: encryptedContent,
    };
  }
}
