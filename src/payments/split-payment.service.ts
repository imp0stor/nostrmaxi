import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentProviderRegistry, PaymentProviderType } from './providers';
import { LnbitsProvider } from './providers/lnbits.provider';
import { BtcpayProvider } from './providers/btcpay.provider';

const DEFAULT_FEE_PERCENT = 5;

@Injectable()
export class SplitPaymentService {
  private readonly logger = new Logger(SplitPaymentService.name);
  private readonly providerRegistry: PaymentProviderRegistry;
  private readonly defaultProviderType: PaymentProviderType;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.providerRegistry = new PaymentProviderRegistry();

    const lnbitsUrl = this.config.get('LNBITS_URL') || 'https://legend.lnbits.com';
    const lnbitsApiKey = this.config.get('LNBITS_API_KEY') || '';
    const lnbitsWebhookSecret = this.config.get('LNBITS_WEBHOOK_SECRET') || this.config.get('WEBHOOK_SECRET');

    if (lnbitsUrl) {
      this.providerRegistry.register(
        new LnbitsProvider({ baseUrl: lnbitsUrl, apiKey: lnbitsApiKey, webhookSecret: lnbitsWebhookSecret }),
      );
    }

    const btcpayBaseUrl =
      this.config.get('BTCPAY_URL') ||
      this.config.get('BTCPAY_BASE_URL') ||
      this.config.get('BTCPAY_SERVER_URL');
    const btcpayApiKey = this.config.get('BTCPAY_API_KEY');
    const btcpayStoreId = this.config.get('BTCPAY_STORE_ID');
    const btcpayWebhookSecret = this.config.get('BTCPAY_WEBHOOK_SECRET') || this.config.get('WEBHOOK_SECRET');

    if (btcpayBaseUrl && btcpayApiKey && btcpayStoreId) {
      this.providerRegistry.register(
        new BtcpayProvider({
          baseUrl: btcpayBaseUrl,
          apiKey: btcpayApiKey,
          storeId: btcpayStoreId,
          webhookSecret: btcpayWebhookSecret,
        }),
      );
    }

    this.defaultProviderType =
      (this.config.get('MARKETPLACE_PAYMENTS_PROVIDER') ||
        this.config.get('PAYMENTS_PROVIDER') ||
        this.config.get('PAYMENT_PROVIDER') ||
        'btcpay') as PaymentProviderType;
  }

  calculateSplit(totalSats: number, feePercent: number = DEFAULT_FEE_PERCENT) {
    if (!Number.isFinite(totalSats) || totalSats <= 0) {
      throw new BadRequestException('totalSats must be greater than 0');
    }
    if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent >= 100) {
      throw new BadRequestException('feePercent must be between 0 and 100');
    }

    const platformFee = Math.floor((totalSats * feePercent) / 100);
    const sellerAmount = totalSats - platformFee;
    return { platformFee, sellerAmount };
  }

  async createMarketplaceInvoice(listingId: string, buyerPubkey: string) {
    const listing = await (this.prisma as any).nip05Listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== 'active') {
      throw new NotFoundException('Listing not available');
    }
    if (!listing.fixedPriceSats) {
      throw new BadRequestException('Listing has no fixed price');
    }

    const sellerUser = await this.ensureSellerLightningAddress(listing.sellerPubkey);
    const split = this.calculateSplit(listing.fixedPriceSats, DEFAULT_FEE_PERCENT);

    const provider = this.getProvider();
    const invoice = await provider.createInvoice({
      amountSats: listing.fixedPriceSats,
      memo: `NostrMaxi Marketplace purchase ${listing.name}@${listing.domain}`,
      expiresInSeconds: 900,
      webhookUrl: `${this.config.get('BASE_URL')}/api/v1/payments/webhook?provider=${provider.type}`,
      metadata: {
        sourceType: 'listing',
        sourceId: listing.id,
        listingId: listing.id,
        buyerPubkey,
      },
    });

    const buyer = await this.prisma.user.findUnique({ where: { pubkey: buyerPubkey } });
    const tx = await (this.prisma as any).marketplaceTransaction.create({
      data: {
        sourceType: 'listing',
        sourceId: listing.id,
        buyerPubkey,
        sellerPubkey: listing.sellerPubkey,
        buyerId: buyer?.id,
        sellerId: sellerUser.id,
        totalSats: listing.fixedPriceSats,
        feeBps: 500,
        platformFeeSats: split.platformFee,
        sellerPayoutSats: split.sellerAmount,
        status: 'pending',
        paymentProvider: provider.type,
        paymentHash: invoice.paymentHash || null,
        providerInvoiceId: invoice.providerInvoiceId,
        metadata: {
          invoice: invoice.bolt11,
        },
      },
    });

    await (this.prisma as any).nip05Listing.update({ where: { id: listing.id }, data: { status: 'pending_sale' } });

    return {
      transactionId: tx.id,
      invoice: invoice.bolt11,
      paymentHash: invoice.paymentHash,
      providerInvoiceId: invoice.providerInvoiceId,
      amountSats: listing.fixedPriceSats,
      split,
      provider: provider.type,
    };
  }

  async createAuctionSettlementInvoice(auctionId: string, buyerPubkey: string) {
    const auction = await (this.prisma as any).nip05Auction.findUnique({
      where: { id: auctionId },
      include: { bids: { orderBy: { amountSats: 'desc' }, take: 1 } },
    });
    if (!auction) throw new NotFoundException('Auction not found');

    const winningBid = auction.bids[0];
    if (!winningBid) throw new BadRequestException('Auction has no winning bid');
    if (winningBid.bidderPubkey !== buyerPubkey) {
      throw new BadRequestException('Only winner can settle auction');
    }

    const sellerPubkey = auction.ownerPubkey || '';
    const sellerUser = await this.ensureSellerLightningAddress(sellerPubkey);

    const split = this.calculateSplit(winningBid.amountSats, DEFAULT_FEE_PERCENT);
    const provider = this.getProvider();

    const invoice = await provider.createInvoice({
      amountSats: winningBid.amountSats,
      memo: `NostrMaxi Auction settlement ${auction.name}@${auction.domain}`,
      expiresInSeconds: 900,
      webhookUrl: `${this.config.get('BASE_URL')}/api/v1/payments/webhook?provider=${provider.type}`,
      metadata: {
        sourceType: 'auction',
        sourceId: auction.id,
        auctionId: auction.id,
        buyerPubkey,
      },
    });

    const buyer = await this.prisma.user.findUnique({ where: { pubkey: buyerPubkey } });
    const tx = await (this.prisma as any).marketplaceTransaction.create({
      data: {
        sourceType: 'auction',
        sourceId: auction.id,
        buyerPubkey,
        sellerPubkey,
        buyerId: buyer?.id,
        sellerId: sellerUser.id,
        totalSats: winningBid.amountSats,
        feeBps: 500,
        platformFeeSats: split.platformFee,
        sellerPayoutSats: split.sellerAmount,
        status: 'pending',
        paymentProvider: provider.type,
        paymentHash: invoice.paymentHash || null,
        providerInvoiceId: invoice.providerInvoiceId,
        metadata: {
          invoice: invoice.bolt11,
        },
      },
    });

    await (this.prisma as any).nip05Auction.update({ where: { id: auction.id }, data: { status: 'settlement_pending' } });

    return {
      transactionId: tx.id,
      invoice: invoice.bolt11,
      paymentHash: invoice.paymentHash,
      providerInvoiceId: invoice.providerInvoiceId,
      amountSats: winningBid.amountSats,
      split,
      provider: provider.type,
    };
  }

  async executeSellerPayout(sellerLightningAddress: string, amountSats: number) {
    const bolt11 = await this.createLnurlPayInvoice(sellerLightningAddress, amountSats);

    const lnbitsUrl = this.config.get('LNBITS_URL');
    const lnbitsAdminKey = this.config.get('LNBITS_ADMIN_KEY') || this.config.get('LNBITS_API_KEY');

    if (!lnbitsUrl || !lnbitsAdminKey) {
      throw new BadRequestException('Seller payout requires LNbits (LNBITS_URL + LNBITS_ADMIN_KEY) configuration');
    }

    const response = await fetch(`${lnbitsUrl}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'X-Api-Key': lnbitsAdminKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ out: true, bolt11 }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new BadRequestException(`Seller payout failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as any;
    return {
      payoutId: data.payment_hash || data.checking_id || null,
      status: 'sent',
      raw: data,
    };
  }

  async processMarketplacePurchase(transactionId: string, paymentId: string) {
    const tx = await (this.prisma as any).marketplaceTransaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Marketplace transaction not found');

    if (tx.status === 'settled' && tx.transferId) {
      return tx;
    }

    const markPaid = await (this.prisma as any).marketplaceTransaction.updateMany({
      where: { id: transactionId, status: 'pending' },
      data: { status: 'paid', paidAt: tx.paidAt || new Date(), paymentId },
    });

    if (markPaid.count === 0) {
      const latest = await (this.prisma as any).marketplaceTransaction.findUnique({ where: { id: transactionId } });
      if (latest?.status === 'settled' || latest?.status === 'paid') return latest;
      throw new BadRequestException('Transaction is not payable in current state');
    }

    const seller = await this.prisma.user.findUnique({ where: { pubkey: tx.sellerPubkey } });
    if (!seller?.lightningAddress) {
      throw new BadRequestException('Seller lightning address is required for payout');
    }

    const payout = await this.executeSellerPayout(seller.lightningAddress, tx.sellerPayoutSats);

    const transfer = await (this.prisma as any).nip05Transfer.create({
      data: {
        sourceType: tx.sourceType,
        sourceId: tx.sourceId,
        buyerPubkey: tx.buyerPubkey,
        sellerPubkey: tx.sellerPubkey,
        amountSats: tx.totalSats,
        platformFeeSats: tx.platformFeeSats,
        sellerPayoutSats: tx.sellerPayoutSats,
        escrowStatus: 'released',
        transferStatus: 'completed',
        completedAt: new Date(),
        note: `Split settlement completed. Provider payment: ${paymentId}`,
      },
    });

    if (tx.sourceType === 'listing') {
      const listing = await (this.prisma as any).nip05Listing.findUnique({ where: { id: tx.sourceId } });
      if (listing) {
        await (this.prisma as any).nip05Listing.update({ where: { id: listing.id }, data: { status: 'sold' } });
        await this.transferNip05OwnershipIfPresent(listing.name, listing.domain, tx.buyerPubkey);
      }
    } else if (tx.sourceType === 'auction') {
      const auction = await (this.prisma as any).nip05Auction.findUnique({ where: { id: tx.sourceId } });
      if (auction) {
        await (this.prisma as any).nip05Auction.update({
          where: { id: auction.id },
          data: {
            status: 'settled',
            winnerPubkey: tx.buyerPubkey,
            winningBidSats: tx.totalSats,
          },
        });
        await this.transferNip05OwnershipIfPresent(auction.name, auction.domain, tx.buyerPubkey);
      }
    }

    await (this.prisma as any).marketplaceTransaction.update({
      where: { id: tx.id },
      data: {
        status: 'settled',
        sellerPayoutStatus: payout.status,
        sellerPayoutId: payout.payoutId,
        paymentId,
        transferId: transfer.id,
        paidAt: new Date(),
        settledAt: new Date(),
      },
    });

    return { transferId: transfer.id, payoutId: payout.payoutId };
  }

  async handleMarketplaceWebhook(payload: any, signature?: string, providerHint?: PaymentProviderType) {
    const providers = providerHint
      ? [this.providerRegistry.get(providerHint)].filter(Boolean) as any[]
      : this.providerRegistry.list();
    const provider = providers.find((p) => p.parseWebhookEvent(payload));
    if (!provider) return { handled: false };

    if (provider.verifyWebhookSignature && !provider.verifyWebhookSignature(payload, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = provider.parseWebhookEvent(payload);
    if (!event || event.state !== 'paid') return { handled: false };

    const tx = await (this.prisma as any).marketplaceTransaction.findFirst({
      where: {
        OR: [
          { providerInvoiceId: event.providerInvoiceId },
          ...(event.paymentHash ? [{ paymentHash: event.paymentHash }] : []),
        ],
      },
    });

    if (!tx) return { handled: false };
    if (tx.status === 'settled') return { handled: true, idempotent: true };

    await this.processMarketplacePurchase(tx.id, event.providerInvoiceId || event.paymentHash || tx.id);
    return { handled: true };
  }

  async setSellerLightningAddress(pubkey: string, lightningAddress: string) {
    const normalized = lightningAddress.trim().toLowerCase();
    if (!this.isValidLightningAddress(normalized)) {
      throw new BadRequestException('Invalid lightning address. Use user@domain.com or lnurl1...');
    }

    const user = await this.prisma.user.findUnique({ where: { pubkey } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { pubkey },
      data: { lightningAddress: normalized },
      select: { pubkey: true, lightningAddress: true, updatedAt: true },
    });
  }

  async adminRetryPayout(transactionId: string) {
    const tx = await (this.prisma as any).marketplaceTransaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Marketplace transaction not found');

    return this.processMarketplacePurchase(tx.id, tx.paymentId || tx.providerInvoiceId || tx.id);
  }

  async getMarketplaceTransactionHistory(limit = 100) {
    return (this.prisma as any).marketplaceTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(limit, 200)),
    });
  }

  private isValidLightningAddress(input: string): boolean {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input) || /^lnurl1[0-9a-z]+$/i.test(input);
  }

  private async ensureSellerLightningAddress(sellerPubkey: string) {
    const seller = await this.prisma.user.findUnique({ where: { pubkey: sellerPubkey } });
    if (!seller) {
      throw new BadRequestException('Seller account not found');
    }
    if (!seller.lightningAddress) {
      throw new BadRequestException('Seller must set a lightningAddress before listing');
    }
    if (!this.isValidLightningAddress(seller.lightningAddress)) {
      throw new BadRequestException('Seller lightningAddress is invalid');
    }
    return seller;
  }

  private async createLnurlPayInvoice(lightningAddress: string, amountSats: number): Promise<string> {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lightningAddress)) {
      throw new BadRequestException('Only lightning addresses are currently supported for payout');
    }

    const [name, domain] = lightningAddress.split('@');
    const amountMsats = amountSats * 1000;

    const lnurlRes = await fetch(`https://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`);
    if (!lnurlRes.ok) {
      throw new BadRequestException(`Failed resolving LNURL pay endpoint for ${lightningAddress}`);
    }

    const lnurlData = (await lnurlRes.json()) as any;
    if (!lnurlData?.callback) {
      throw new BadRequestException('Lightning address callback missing');
    }
    if (amountMsats < Number(lnurlData.minSendable || 0) || amountMsats > Number(lnurlData.maxSendable || Number.MAX_SAFE_INTEGER)) {
      throw new BadRequestException('Payout amount outside seller wallet LNURL range');
    }

    const callbackUrl = new URL(lnurlData.callback);
    callbackUrl.searchParams.set('amount', String(amountMsats));
    callbackUrl.searchParams.set('comment', 'NostrMaxi marketplace payout');

    const invRes = await fetch(callbackUrl.toString());
    if (!invRes.ok) {
      throw new BadRequestException(`Failed requesting seller invoice from LNURL callback`);
    }

    const invData = (await invRes.json()) as any;
    if (!invData?.pr) {
      throw new BadRequestException('LNURL callback did not return invoice');
    }

    return invData.pr;
  }

  private async transferNip05OwnershipIfPresent(localPart: string, domain: string, buyerPubkey: string) {
    const buyer = await this.prisma.user.findUnique({ where: { pubkey: buyerPubkey } });
    if (!buyer) return;

    const existing = await this.prisma.nip05.findFirst({
      where: { localPart: localPart.toLowerCase(), domain: domain.toLowerCase(), isActive: true },
    });
    if (!existing) return;

    await this.prisma.nip05.update({
      where: { id: existing.id },
      data: { userId: buyer.id },
    });
  }

  private getProvider(preferredType?: PaymentProviderType) {
    const requested = preferredType || this.defaultProviderType;
    if (requested) {
      const provider = this.providerRegistry.get(requested);
      if (provider) return provider;
    }

    const fallback = this.providerRegistry.get('btcpay') || this.providerRegistry.get('lnbits') || this.providerRegistry.list()[0];
    if (!fallback) {
      throw new BadRequestException('No payment providers configured for marketplace invoicing');
    }

    return fallback;
  }
}
