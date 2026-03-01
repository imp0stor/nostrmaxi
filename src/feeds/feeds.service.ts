import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedDto, FeedTier } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { SimplePool } from 'nostr-tools';

type NostrEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
};

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];

@Injectable()
export class FeedsService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOrCreateUser(pubkey: string) {
    const existing = await this.prisma.user.findUnique({ where: { pubkey } });
    if (existing) return existing;

    return this.prisma.user.create({
      data: {
        pubkey,
        npub: `npub_${pubkey.slice(0, 16)}_${Date.now()}`,
      },
    });
  }

  private normalizeFilterConfig(input: Partial<CreateFeedDto> = {}) {
    const contentTypes = Array.isArray(input.contentTypes) ? input.contentTypes : ['text'];
    return {
      contentTypes,
      tier: (input.tier || 'genuine') as FeedTier,
      wotThreshold: Number.isFinite(input.wotThreshold) ? Number(input.wotThreshold) : 35,
    };
  }

  async create(pubkey: string, dto: CreateFeedDto) {
    const user = await this.findOrCreateUser(pubkey);
    const filterConfig = this.normalizeFilterConfig(dto);

    return this.prisma.feed.create({
      data: {
        userId: user.id,
        name: dto.name,
        isPublic: dto.isPublic ?? true,
        filterConfig,
      },
    });
  }

  async listMine(pubkey: string) {
    const user = await this.findOrCreateUser(pubkey);
    return this.prisma.feed.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(pubkey: string, feedId: string, dto: UpdateFeedDto) {
    const user = await this.findOrCreateUser(pubkey);
    const existing = await this.prisma.feed.findFirst({ where: { id: feedId, userId: user.id } });
    if (!existing) throw new NotFoundException('Feed not found');

    const nextFilterConfig = this.normalizeFilterConfig({
      ...(existing.filterConfig as object),
      ...dto,
    } as Partial<CreateFeedDto>);

    return this.prisma.feed.update({
      where: { id: feedId },
      data: {
        name: dto.name ?? existing.name,
        isPublic: dto.isPublic ?? existing.isPublic,
        filterConfig: nextFilterConfig,
      },
    });
  }

  async remove(pubkey: string, feedId: string) {
    const user = await this.findOrCreateUser(pubkey);
    const existing = await this.prisma.feed.findFirst({ where: { id: feedId, userId: user.id } });
    if (!existing) throw new NotFoundException('Feed not found');
    await this.prisma.feed.delete({ where: { id: feedId } });
    return { ok: true };
  }

  async subscribe(pubkey: string, feedId: string) {
    const user = await this.findOrCreateUser(pubkey);
    const target = await this.prisma.feed.findUnique({ where: { id: feedId } });
    if (!target || !target.isPublic) throw new NotFoundException('Public feed not found');

    return this.prisma.feedSubscription.upsert({
      where: { userId_feedId: { userId: user.id, feedId } },
      update: {},
      create: { userId: user.id, feedId },
      include: { feed: true },
    });
  }

  async unsubscribe(pubkey: string, feedId: string) {
    const user = await this.findOrCreateUser(pubkey);
    await this.prisma.feedSubscription.deleteMany({ where: { userId: user.id, feedId } });
    return { ok: true };
  }

  async listSubscriptions(pubkey: string) {
    const user = await this.findOrCreateUser(pubkey);
    return this.prisma.feedSubscription.findMany({
      where: { userId: user.id },
      include: { feed: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private scoreEvent(event: NostrEvent, interactions: NostrEvent[]): number {
    const now = Math.floor(Date.now() / 1000);
    const ageHours = Math.max(1, (now - event.created_at) / 3600);
    const decay = 1 / Math.pow(ageHours, 0.9);

    const reactions = interactions.filter((e) => e.kind === 7).length;
    const reposts = interactions.filter((e) => e.kind === 6).length;
    const zaps = interactions.filter((e) => e.kind === 9735).length;
    const engagement = reactions + reposts * 2 + zaps * 3;
    const velocity = engagement / ageHours;

    return Number((engagement * decay + velocity).toFixed(4));
  }

  async getTrending(limit = 50) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const pool = new SimplePool();

    try {
      const notes = (await pool.querySync(DEFAULT_RELAYS, {
        kinds: [1],
        limit: safeLimit * 4,
      } as any)) as NostrEvent[];

      const noteIds = notes.map((n) => n.id).slice(0, 250);
      const interactions = noteIds.length > 0
        ? ((await pool.querySync(DEFAULT_RELAYS, {
            kinds: [6, 7, 9735],
            '#e': noteIds,
            limit: 4000,
          } as any)) as NostrEvent[])
        : [];

      const interactionsByEvent = new Map<string, NostrEvent[]>();
      for (const evt of interactions) {
        const eTag = evt.tags?.find((tag) => tag[0] === 'e' && tag[1]);
        const target = eTag?.[1];
        if (!target) continue;
        if (!interactionsByEvent.has(target)) interactionsByEvent.set(target, []);
        interactionsByEvent.get(target)!.push(evt);
      }

      return notes
        .map((note) => {
          const ints = interactionsByEvent.get(note.id) || [];
          return {
            id: note.id,
            pubkey: note.pubkey,
            content: note.content,
            createdAt: note.created_at,
            stats: {
              reposts: ints.filter((evt) => evt.kind === 6).length,
              reactions: ints.filter((evt) => evt.kind === 7).length,
              zaps: ints.filter((evt) => evt.kind === 9735).length,
            },
            score: this.scoreEvent(note, ints),
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, safeLimit);
    } finally {
      pool.close(DEFAULT_RELAYS);
    }
  }

  private xmlEscape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async buildRss(feedId: string, requestBase = 'https://nostrmaxi.com') {
    const feed = await this.prisma.feed.findUnique({
      where: { id: feedId },
      include: { user: true },
    });
    if (!feed || !feed.isPublic) throw new NotFoundException('Feed not found');

    const tier = ((feed.filterConfig as any)?.tier || 'genuine') as FeedTier;
    const wotThreshold = Number((feed.filterConfig as any)?.wotThreshold ?? 35);

    const trending = await this.getTrending(30);
    const filtered = trending.filter((item) => {
      if (tier === 'firehose') return true;
      if (tier === 'genuine') return (item.stats.reactions + item.stats.reposts + item.stats.zaps) >= 1 || item.content.length >= 40;
      if (tier === 'wot') return item.score >= Math.max(1, wotThreshold / 10);
      return true;
    });

    const itemsXml = filtered
      .map((item) => {
        const description = this.xmlEscape(item.content.slice(0, 420));
        const title = this.xmlEscape(`Post ${item.id.slice(0, 10)}`);
        const link = `${requestBase.replace(/\/$/, '')}/feed/post/${item.id}`;
        return `<item><title>${title}</title><description>${description}</description><pubDate>${new Date(item.createdAt * 1000).toUTCString()}</pubDate><link>${link}</link><guid>${item.id}</guid></item>`;
      })
      .join('');

    const channelTitle = this.xmlEscape(feed.name);
    const channelDesc = this.xmlEscape(`Public feed by ${feed.user.pubkey.slice(0, 12)}…`);
    const channelLink = `${requestBase.replace(/\/$/, '')}/feeds/${feed.id}`;

    return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${channelTitle}</title><description>${channelDesc}</description><link>${channelLink}</link>${itemsXml}</channel></rss>`;
  }
}
