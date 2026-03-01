import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGiftCardDto, RedeemGiftCardDto } from './dto/gift-card.dto';

const PLATFORM_FEE_BPS = 200; // 2%

type GiftCardStatus = 'unfunded' | 'funded' | 'partially_redeemed' | 'fully_redeemed' | 'expired';

export interface GiftCardDesign {
  name: string;
  title: string;
  imageUrl: string;
  category: 'birthday' | 'holiday' | 'thank_you' | 'bitcoin' | 'nostr';
  custom: boolean;
}

const BUILT_IN_DESIGNS: GiftCardDesign[] = [
  { name: 'bitcoin', title: 'Bitcoin Orange', imageUrl: '/gift-cards/designs/bitcoin-orange.svg', category: 'bitcoin', custom: false },
  { name: 'nostr', title: 'Nostr Purple', imageUrl: '/gift-cards/designs/nostr-purple.svg', category: 'nostr', custom: false },
  { name: 'birthday', title: 'Birthday Blast', imageUrl: '/gift-cards/designs/birthday-blast.svg', category: 'birthday', custom: false },
  { name: 'holiday', title: 'Holiday Cheer', imageUrl: '/gift-cards/designs/holiday-cheer.svg', category: 'holiday', custom: false },
  { name: 'thank-you', title: 'Thank You Stack', imageUrl: '/gift-cards/designs/thank-you-stack.svg', category: 'thank_you', custom: false },
  { name: 'orange-noir', title: 'Orange Noir', imageUrl: '/gift-cards/designs/orange-noir.svg', category: 'bitcoin', custom: false },
];

@Injectable()
export class GiftCardsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(pubkey: string, dto: CreateGiftCardDto) {
    const user = await this.prisma.user.findUnique({ where: { pubkey }, include: { subscription: true } });
    if (!user) throw new NotFoundException('User not found');

    const normalizedDesignName = (dto.designName || 'bitcoin').trim().toLowerCase();
    const builtIn = BUILT_IN_DESIGNS.find((d) => d.name === normalizedDesignName);

    const tier = String(user.subscription?.tier || 'FREE').toUpperCase();
    const canUseCustomDesign = user.isAdmin || ['PRO', 'BUSINESS', 'LIFETIME', 'CREATOR'].includes(tier);

    if (!builtIn && !dto.designUrl) {
      throw new BadRequestException('Unknown designName. Provide a built-in designName or custom designUrl.');
    }

    if (dto.designUrl && !canUseCustomDesign) {
      throw new ForbiddenException('Custom gift card designs require Creator tier or higher.');
    }

    const code = this.generateCode();
    const fundingInvoice = this.mockFundingInvoice(dto.amountSats, code);

    const card = await this.prisma.giftCard.create({
      data: {
        code,
        creatorPubkey: pubkey,
        amountSats: dto.amountSats,
        remainingSats: dto.amountSats,
        designName: dto.designUrl ? 'custom' : (builtIn?.name || 'bitcoin'),
        designUrl: dto.designUrl || builtIn?.imageUrl,
        message: dto.message,
        status: 'unfunded',
        fundingInvoice,
        fundingPaid: false,
      },
    });

    return {
      ...card,
      redemptionUrl: `/gift-cards/redeem?code=${encodeURIComponent(card.code)}`,
      feeBps: PLATFORM_FEE_BPS,
    };
  }

  async listMine(pubkey: string) {
    return this.prisma.giftCard.findMany({
      where: { creatorPubkey: pubkey },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBalance(code: string) {
    const card = await this.prisma.giftCard.findUnique({ where: { code } });
    if (!card) throw new NotFoundException('Gift card not found');

    return {
      code: card.code,
      amountSats: card.amountSats,
      remainingSats: card.remainingSats,
      status: card.status,
      fundingPaid: card.fundingPaid,
      message: card.message,
      designName: card.designName,
      designUrl: card.designUrl,
      expiresAt: card.expiresAt,
    };
  }

  async markFunded(pubkey: string, code: string, paymentRef: string) {
    const card = await this.prisma.giftCard.findUnique({ where: { code } });
    if (!card) throw new NotFoundException('Gift card not found');
    if (card.creatorPubkey !== pubkey) throw new ForbiddenException('Only the creator can confirm funding');
    if (card.fundingPaid) return card;

    const feeSats = Math.ceil((card.amountSats * PLATFORM_FEE_BPS) / 10_000);
    const fundedAmount = Math.max(card.amountSats - feeSats, 0);

    return this.prisma.giftCard.update({
      where: { code },
      data: {
        fundingPaid: true,
        status: fundedAmount > 0 ? 'funded' : 'fully_redeemed',
        remainingSats: fundedAmount,
        redeemedAt: fundedAmount > 0 ? null : new Date(),
        redeemedBy: fundedAmount > 0 ? null : paymentRef,
      },
    });
  }

  async redeem(code: string, dto: RedeemGiftCardDto) {
    const card = await this.prisma.giftCard.findUnique({ where: { code } });
    if (!card) throw new NotFoundException('Gift card not found');

    if (card.expiresAt && card.expiresAt < new Date()) {
      await this.setStatus(code, 'expired');
      throw new BadRequestException('Gift card expired');
    }

    if (!card.fundingPaid || card.status === 'unfunded') {
      throw new BadRequestException('Gift card is not funded yet');
    }

    if (card.remainingSats <= 0 || card.status === 'fully_redeemed') {
      throw new BadRequestException('Gift card has no remaining balance');
    }

    if (!dto.invoice && !dto.lightningAddress) {
      throw new BadRequestException('Provide either a Lightning invoice or Lightning address for payout');
    }

    const redeemAmount = Math.min(dto.amountSats || card.remainingSats, card.remainingSats);
    const remainingSats = card.remainingSats - redeemAmount;
    const status: GiftCardStatus = remainingSats > 0 ? 'partially_redeemed' : 'fully_redeemed';

    const updated = await this.prisma.giftCard.update({
      where: { code },
      data: {
        remainingSats,
        status,
        redeemedAt: remainingSats === 0 ? new Date() : null,
        redeemedBy: dto.redeemerPubkey || dto.lightningAddress || 'invoice',
      },
    });

    return {
      code: updated.code,
      redeemedSats: redeemAmount,
      remainingSats: updated.remainingSats,
      status: updated.status,
      payout: dto.invoice
        ? { type: 'invoice', invoice: dto.invoice }
        : { type: 'lightning_address', lightningAddress: dto.lightningAddress },
      settled: true,
    };
  }

  getDesigns() {
    return BUILT_IN_DESIGNS;
  }

  private async setStatus(code: string, status: GiftCardStatus) {
    await this.prisma.giftCard.update({ where: { code }, data: { status } });
  }

  private generateCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const length = 12;
    let token = '';
    for (let i = 0; i < length; i++) {
      token += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return `${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8)}`;
  }

  private mockFundingInvoice(amountSats: number, code: string): string {
    return `lnbc${amountSats}n1p${code.replace(/-/g, '').toLowerCase()}`;
  }
}
