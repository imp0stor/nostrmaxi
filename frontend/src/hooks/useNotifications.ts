import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { NotificationItem } from '../types';

export function useNotifications(enabled: boolean) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.readAt).length,
    [notifications],
  );

  const refresh = useCallback(async () => {
    if (!enabled) {
      setNotifications([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const items = await api.getNotifications(100);
      setNotifications(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  const markRead = useCallback(async (id: string) => {
    await api.markNotificationRead(id);
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item)));
  }, []);

  const markAllRead = useCallback(async () => {
    await api.markAllNotificationsRead();
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((item) => ({ ...item, readAt: item.readAt || now })));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      void refresh();
    }, 30_000);

    return () => clearInterval(timer);
  }, [enabled, refresh]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh,
    markRead,
    markAllRead,
  };
}
