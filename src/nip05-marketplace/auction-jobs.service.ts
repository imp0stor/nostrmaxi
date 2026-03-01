import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Nip05MarketplaceService } from './nip05-marketplace.service';

@Injectable()
export class AuctionJobsService implements OnModuleInit {
  private readonly logger = new Logger(AuctionJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketplace: Nip05MarketplaceService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.logger.log('Auction cron jobs registered: settleEndedAuctions(* * * * *) and sendEndingSoonReminders(*/5 * * * *)');
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async settleEndedAuctions() {
    const now = new Date();
    const auctions = await (this.prisma as any).nip05Auction.findMany({
      where: {
        status: 'live',
        endsAt: { lte: now },
      },
      include: {
        bids: {
          orderBy: [{ amountSats: 'desc' }, { createdAt: 'asc' }],
          take: 1,
        },
      },
    });

    if (auctions.length > 0) {
      this.logger.log(`Auction settlement cron: found ${auctions.length} ended live auction(s)`);
    }

    for (const auction of auctions) {
      try {
        await this.marketplace.finalizeAuction(auction.id);
        const winner = auction.bids[0];

        if (!winner || (auction.reservePriceSats && winner.amountSats < auction.reservePriceSats)) {
          if (winner?.bidderPubkey) {
            await this.notifications.createDeduped({
              userPubkey: winner.bidderPubkey,
              type: 'auction_lost',
              title: `Auction ended: ${auction.name}@${auction.domain}`,
              body: auction.reservePriceSats && winner.amountSats < auction.reservePriceSats
                ? 'Auction ended without sale because reserve was not met.'
                : 'Auction ended without a winning bid.',
              link: `/marketplace?auctionId=${auction.id}`,
              dedupeSince: new Date(Date.now() - 1000 * 60 * 60),
            });
          }
          this.logger.log(`Auction ${auction.id} ended no-sale`);
          continue;
        }

        await this.notifications.createDeduped({
          userPubkey: winner.bidderPubkey,
          type: 'auction_won',
          title: `You won ${auction.name}@${auction.domain}`,
          body: `Winning bid: ${winner.amountSats.toLocaleString()} sats. Complete settlement to claim ownership.`,
          link: `/marketplace?auctionId=${auction.id}`,
          dedupeSince: new Date(Date.now() - 1000 * 60 * 60),
        });

        this.logger.log(`Auction ${auction.id} settled with winner ${winner.bidderPubkey}`);
      } catch (error) {
        this.logger.error(`Failed settling auction ${auction.id}: ${(error as Error).message}`);
      }
    }
  }

  @Cron('*/5 * * * *')
  async sendEndingSoonReminders() {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const auctions = await (this.prisma as any).nip05Auction.findMany({
      where: {
        status: 'live',
        endsAt: { lte: oneHourFromNow, gt: now },
      },
      include: {
        bids: {
          orderBy: [{ amountSats: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    for (const auction of auctions) {
      const watcherPubkeys: string[] = Array.from(new Set(auction.bids.map((bid: any) => String(bid.bidderPubkey))));

      for (const watcherPubkey of watcherPubkeys) {
        try {
          await this.notifications.createDeduped({
            userPubkey: String(watcherPubkey),
            type: 'auction_ending',
            title: `Auction ending soon: ${auction.name}@${auction.domain}`,
            body: 'This auction ends in less than 1 hour. Place your final bid soon.',
            link: `/marketplace?auctionId=${auction.id}`,
            dedupeSince: new Date(auction.endsAt.getTime() - 60 * 60 * 1000),
          });
        } catch (error) {
          this.logger.error(`Reminder create failed for auction ${auction.id}: ${(error as Error).message}`);
        }
      }
    }
  }
}
