import { SimplePool, finalizeEvent, getPublicKey, nip44, type Event as NostrEvent } from 'nostr-tools';
import {
  DEFAULT_FEED_SUBSCRIPTIONS,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_TOPIC_SUBSCRIPTIONS,
  DEFAULT_USER_SUBSCRIPTIONS,
  LIST_D_TAGS,
  SUBSCRIPTION_LIST_KIND,
  type FeedSubscriptions,
  type NotificationPreferences,
  type TopicSubscriptions,
  type UserSubscriptions,
} from './subscriptionLists';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.primal.net'];

function getConversationKey(privateKey: Uint8Array): Uint8Array {
  const pubkey = getPublicKey(privateKey);
  return nip44.v2.utils.getConversationKey(privateKey, pubkey);
}

async function loadEncryptedList<T>(
  dTag: string,
  defaultValue: T,
  pubkey: string,
  privateKey: Uint8Array,
  relays: string[] = DEFAULT_RELAYS,
): Promise<T> {
  const pool = new SimplePool();
  try {
    const events = await pool.querySync(relays, {
      kinds: [SUBSCRIPTION_LIST_KIND],
      authors: [pubkey],
      '#d': [dTag],
      limit: 20,
    } as any);

    const latest = [...(events as NostrEvent[])].sort((a, b) => b.created_at - a.created_at)[0];
    if (!latest) return defaultValue;

    const encryptedTag = latest.tags.find((t) => t[0] === 'encrypted' && t[1] === 'nip44');
    if (!encryptedTag || !latest.content) {
      try {
        return { ...defaultValue, ...(JSON.parse(latest.content || '{}') as Partial<T>) };
      } catch {
        return defaultValue;
      }
    }

    const conversationKey = getConversationKey(privateKey);
    const plaintext = nip44.v2.decrypt(latest.content, conversationKey);
    const parsed = JSON.parse(plaintext) as Partial<T>;
    return { ...defaultValue, ...parsed };
  } catch {
    return defaultValue;
  } finally {
    pool.close(relays);
  }
}

async function saveEncryptedList<T>(
  dTag: string,
  data: T,
  pubkey: string,
  privateKey: Uint8Array,
  relays: string[] = DEFAULT_RELAYS,
): Promise<void> {
  const conversationKey = getConversationKey(privateKey);
  const encryptedContent = nip44.v2.encrypt(JSON.stringify(data), conversationKey);

  const unsigned = {
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

  const signed = finalizeEvent(unsigned, privateKey);
  const pool = new SimplePool();
  try {
    const pubs = pool.publish(relays, signed as any);
    await Promise.all(pubs as any);
  } finally {
    pool.close(relays);
  }
}

export const loadFeedSubscriptions = (pubkey: string, privateKey: Uint8Array, relays?: string[]) =>
  loadEncryptedList(LIST_D_TAGS.FEED_SUBSCRIPTIONS, DEFAULT_FEED_SUBSCRIPTIONS, pubkey, privateKey, relays);

export const loadTopicSubscriptions = (pubkey: string, privateKey: Uint8Array, relays?: string[]) =>
  loadEncryptedList(LIST_D_TAGS.TOPIC_SUBSCRIPTIONS, DEFAULT_TOPIC_SUBSCRIPTIONS, pubkey, privateKey, relays);

export const loadUserSubscriptions = (pubkey: string, privateKey: Uint8Array, relays?: string[]) =>
  loadEncryptedList(LIST_D_TAGS.USER_SUBSCRIPTIONS, DEFAULT_USER_SUBSCRIPTIONS, pubkey, privateKey, relays);

export const loadNotificationPrefs = (pubkey: string, privateKey: Uint8Array, relays?: string[]) =>
  loadEncryptedList(LIST_D_TAGS.NOTIFICATION_PREFS, DEFAULT_NOTIFICATION_PREFS, pubkey, privateKey, relays);

export const saveFeedSubscriptions = (data: FeedSubscriptions, pubkey: string, privateKey: Uint8Array, relays?: string[]) =>
  saveEncryptedList(LIST_D_TAGS.FEED_SUBSCRIPTIONS, data, pubkey, privateKey, relays);

export const saveTopicSubscriptions = (data: TopicSubscriptions, pubkey: string, privateKey: Uint8Array, relays?: string[]) =>
  saveEncryptedList(LIST_D_TAGS.TOPIC_SUBSCRIPTIONS, data, pubkey, privateKey, relays);

export const saveUserSubscriptions = (data: UserSubscriptions, pubkey: string, privateKey: Uint8Array, relays?: string[]) =>
  saveEncryptedList(LIST_D_TAGS.USER_SUBSCRIPTIONS, data, pubkey, privateKey, relays);

export const saveNotificationPrefs = (data: NotificationPreferences, pubkey: string, privateKey: Uint8Array, relays?: string[]) =>
  saveEncryptedList(LIST_D_TAGS.NOTIFICATION_PREFS, data, pubkey, privateKey, relays);
