import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const NOTIFICATIONS_DATA_PATH = 'NOTIFICATIONS_DATA_PATH';

export interface NotificationItem {
  id: string;
  type: 'system' | 'mention' | 'reply' | 'zap' | 'follow';
  title: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
  link?: string;
}

interface NotificationsStore {
  byPubkey: Record<string, NotificationItem[]>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly dataPath: string;
  private cache: NotificationsStore | null = null;

  constructor(@Optional() @Inject(NOTIFICATIONS_DATA_PATH) dataPath?: string) {
    this.dataPath = dataPath || resolve(process.cwd(), 'data/notifications.json');
  }

  async list(pubkey: string, limit = 50): Promise<NotificationItem[]> {
    const store = await this.load();
    const items = this.ensureSeeded(store, pubkey);
    await this.persist(store);

    return items
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, Math.max(1, Math.min(limit, 200)));
  }

  async unreadCount(pubkey: string): Promise<number> {
    const store = await this.load();
    const items = this.ensureSeeded(store, pubkey);
    await this.persist(store);
    return items.filter((item) => !item.readAt).length;
  }

  async markRead(pubkey: string, notificationId: string): Promise<NotificationItem | null> {
    const store = await this.load();
    const items = this.ensureSeeded(store, pubkey);
    const target = items.find((item) => item.id === notificationId);

    if (!target) {
      return null;
    }

    if (!target.readAt) {
      target.readAt = new Date().toISOString();
      await this.persist(store);
    }

    return target;
  }

  async markAllRead(pubkey: string): Promise<{ marked: number }> {
    const store = await this.load();
    const items = this.ensureSeeded(store, pubkey);
    const unread = items.filter((item) => !item.readAt);
    const now = new Date().toISOString();

    unread.forEach((item) => {
      item.readAt = now;
    });

    if (unread.length > 0) {
      await this.persist(store);
    }

    return { marked: unread.length };
  }

  private ensureSeeded(store: NotificationsStore, pubkey: string): NotificationItem[] {
    if (!store.byPubkey[pubkey]) {
      store.byPubkey[pubkey] = this.defaultNotifications();
    }
    return store.byPubkey[pubkey];
  }

  private defaultNotifications(): NotificationItem[] {
    const now = Date.now();
    return [
      {
        id: `notif_${now}`,
        type: 'system',
        title: 'Welcome to notifications',
        body: 'You can track mentions, replies, follows, and zaps here.',
        createdAt: new Date(now).toISOString(),
        readAt: null,
        link: '/feed',
      },
      {
        id: `notif_${now - 1}`,
        type: 'system',
        title: 'Pro tip',
        body: 'Open Settings → Notifications to tune your preferences.',
        createdAt: new Date(now - 60_000).toISOString(),
        readAt: null,
        link: '/settings',
      },
    ];
  }

  private async load(): Promise<NotificationsStore> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const raw = await readFile(this.dataPath, 'utf8');
      const parsed = JSON.parse(raw) as NotificationsStore;
      this.cache = {
        byPubkey: parsed?.byPubkey || {},
      };
    } catch (error) {
      this.cache = { byPubkey: {} };
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Failed reading notifications store: ${(error as Error).message}`);
      }
    }

    return this.cache;
  }

  private async persist(store: NotificationsStore): Promise<void> {
    this.cache = store;
    await mkdir(dirname(this.dataPath), { recursive: true });
    await writeFile(this.dataPath, JSON.stringify(store, null, 2), 'utf8');
  }
}
