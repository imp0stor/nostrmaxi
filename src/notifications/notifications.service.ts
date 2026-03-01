import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationType =
  | 'outbid'
  | 'auction_ending'
  | 'auction_won'
  | 'auction_lost'
  | 'system'
  | 'mention'
  | 'reply'
  | 'zap'
  | 'follow';

export interface NotificationItem {
  id: string;
  userPubkey: string;
  type: NotificationType | string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
  link?: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    userPubkey: string;
    type: string;
    title: string;
    body: string;
    link?: string | null;
  }): Promise<NotificationItem> {
    const row = await (this.prisma as any).notification.create({
      data: {
        userPubkey: input.userPubkey,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link || null,
      },
    });

    return this.toItem(row);
  }

  async createDeduped(input: {
    userPubkey: string;
    type: string;
    title: string;
    body: string;
    link?: string | null;
    dedupeSince: Date;
  }): Promise<NotificationItem | null> {
    const existing = await (this.prisma as any).notification.findFirst({
      where: {
        userPubkey: input.userPubkey,
        type: input.type,
        title: input.title,
        link: input.link || null,
        createdAt: { gte: input.dedupeSince },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) return null;

    return this.create(input);
  }

  async list(pubkey: string, limit = 50, unreadOnly = false): Promise<NotificationItem[]> {
    const rows = await (this.prisma as any).notification.findMany({
      where: {
        userPubkey: pubkey,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(limit, 200)),
    });

    return rows.map((row: any) => this.toItem(row));
  }

  async unreadCount(pubkey: string): Promise<number> {
    return (this.prisma as any).notification.count({ where: { userPubkey: pubkey, read: false } });
  }

  async markRead(pubkey: string, notificationId: string): Promise<NotificationItem | null> {
    const existing = await (this.prisma as any).notification.findFirst({
      where: { id: notificationId, userPubkey: pubkey },
    });

    if (!existing) return null;

    if (!existing.read) {
      await (this.prisma as any).notification.update({
        where: { id: notificationId },
        data: { read: true },
      });
      existing.read = true;
    }

    return this.toItem(existing);
  }

  async markAllRead(pubkey: string): Promise<{ marked: number }> {
    const result = await (this.prisma as any).notification.updateMany({
      where: { userPubkey: pubkey, read: false },
      data: { read: true },
    });

    return { marked: result.count || 0 };
  }

  async maybeSendNostrDm(userPubkey: string, title: string, body: string) {
    this.logger.debug(`Optional Nostr DM not configured. target=${userPubkey} title=${title} body=${body}`);
  }

  private toItem(row: any): NotificationItem {
    return {
      id: row.id,
      userPubkey: row.userPubkey,
      type: row.type,
      title: row.title,
      body: row.body,
      createdAt: new Date(row.createdAt).toISOString(),
      readAt: row.read ? new Date(row.createdAt).toISOString() : null,
      link: row.link || null,
    };
  }
}
