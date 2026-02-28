import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_FEED_SUBSCRIPTIONS,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_TOPIC_SUBSCRIPTIONS,
  DEFAULT_USER_SUBSCRIPTIONS,
  type FeedSubscriptions,
  type NotificationPreferences,
  type TopicSubscriptions,
  type UserSubscriptions,
} from '../lib/subscriptionLists';
import {
  loadFeedSubscriptions,
  loadNotificationPrefs,
  loadTopicSubscriptions,
  loadUserSubscriptions,
  saveFeedSubscriptions,
  saveNotificationPrefs,
  saveTopicSubscriptions,
  saveUserSubscriptions,
} from '../lib/subscriptions';

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.primal.net'];

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[a-f0-9]{64}$/i.test(hex)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function useSubscriptions(pubkey?: string) {
  const [feedSubs, setFeedSubs] = useState<FeedSubscriptions>(DEFAULT_FEED_SUBSCRIPTIONS);
  const [topicSubs, setTopicSubs] = useState<TopicSubscriptions>(DEFAULT_TOPIC_SUBSCRIPTIONS);
  const [userSubs, setUserSubs] = useState<UserSubscriptions>(DEFAULT_USER_SUBSCRIPTIONS);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);
  const [loading, setLoading] = useState(true);

  const privateKey = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const nsecHex = sessionStorage.getItem('nostrmaxi_nsec_hex') || '';
    return hexToBytes(nsecHex);
  }, [pubkey]);

  const loadAll = useCallback(async () => {
    if (!pubkey || !privateKey) {
      setFeedSubs(DEFAULT_FEED_SUBSCRIPTIONS);
      setTopicSubs(DEFAULT_TOPIC_SUBSCRIPTIONS);
      setUserSubs(DEFAULT_USER_SUBSCRIPTIONS);
      setNotifPrefs(DEFAULT_NOTIFICATION_PREFS);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [feeds, topics, users, prefs] = await Promise.all([
      loadFeedSubscriptions(pubkey, privateKey, DEFAULT_RELAYS),
      loadTopicSubscriptions(pubkey, privateKey, DEFAULT_RELAYS),
      loadUserSubscriptions(pubkey, privateKey, DEFAULT_RELAYS),
      loadNotificationPrefs(pubkey, privateKey, DEFAULT_RELAYS),
    ]);

    setFeedSubs(feeds);
    setTopicSubs(topics);
    setUserSubs(users);
    setNotifPrefs(prefs);
    setLoading(false);
  }, [pubkey, privateKey]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const subscribeFeed = useCallback(async (feed: { id: string; name: string; definition: string }) => {
    if (!pubkey || !privateKey) return;
    const existing = feedSubs.feeds.filter((item) => item.id !== feed.id);
    const next = { feeds: [...existing, { ...feed, enabled: true }] };
    setFeedSubs(next);
    await saveFeedSubscriptions(next, pubkey, privateKey, DEFAULT_RELAYS);
  }, [feedSubs, privateKey, pubkey]);

  const unsubscribeFeed = useCallback(async (feedId: string) => {
    if (!pubkey || !privateKey) return;
    const next = { feeds: feedSubs.feeds.filter((item) => item.id !== feedId) };
    setFeedSubs(next);
    await saveFeedSubscriptions(next, pubkey, privateKey, DEFAULT_RELAYS);
  }, [feedSubs, privateKey, pubkey]);

  const subscribeToTopic = useCallback(async (hashtag: string) => {
    if (!pubkey || !privateKey) return;
    const normalized = hashtag.toLowerCase().replace(/^#/, '').trim();
    if (!normalized) return;
    const next = { ...topicSubs, hashtags: Array.from(new Set([...topicSubs.hashtags, normalized])) };
    setTopicSubs(next);
    await saveTopicSubscriptions(next, pubkey, privateKey, DEFAULT_RELAYS);
  }, [privateKey, pubkey, topicSubs]);

  const subscribeToUser = useCallback(async (
    watchedPubkey: string,
    options?: Partial<UserSubscriptions['users'][number]>,
  ) => {
    if (!pubkey || !privateKey) return;
    const normalized = watchedPubkey.trim();
    if (!normalized) return;
    const nextUser = {
      pubkey: normalized,
      notifyOnPost: options?.notifyOnPost ?? true,
      notifyOnReply: options?.notifyOnReply ?? true,
      notifyOnZap: options?.notifyOnZap ?? true,
    };
    const next = {
      users: [...userSubs.users.filter((item) => item.pubkey !== normalized), nextUser],
    };
    setUserSubs(next);
    await saveUserSubscriptions(next, pubkey, privateKey, DEFAULT_RELAYS);
  }, [privateKey, pubkey, userSubs]);

  const updateNotificationPrefs = useCallback(async (prefs: NotificationPreferences) => {
    if (!pubkey || !privateKey) return;
    setNotifPrefs(prefs);
    await saveNotificationPrefs(prefs, pubkey, privateKey, DEFAULT_RELAYS);
  }, [privateKey, pubkey]);

  return {
    feedSubs,
    topicSubs,
    userSubs,
    notifPrefs,
    subscribeFeed,
    unsubscribeFeed,
    subscribeToTopic,
    subscribeToUser,
    updateNotificationPrefs,
    loading,
    reload: loadAll,
  };
}
