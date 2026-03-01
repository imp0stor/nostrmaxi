import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';
import { CreateGiftCardDto, RedeemGiftCardDto, SetGiftCardFundedDto } from './dto/gift-card.dto';
import { GiftCardsService } from './gift-cards.service';

@ApiTags('gift-cards')
@Controller('api/v1/gift-cards')
export class GiftCardsController {
  constructor(
    private readonly giftCardsService: GiftCardsService,
    private readonly authService: AuthService,
  ) {}

  private async resolvePubkey(req: Request, authHeader: string, method: string): Promise<string> {
    const fromGuard = (req as any).pubkey;
    if (fromGuard) return fromGuard;

    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    return this.authService.verifyAuth(authHeader, method, url);
  }

  @Get('designs')
  getDesigns() {
    return this.giftCardsService.getDesigns();
  }

  @Post()
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  create(
    @Headers('authorization') auth: string,
    @Req() req: Request,
    @Body() body: CreateGiftCardDto,
  ) {
    return this.resolvePubkey(req, auth, 'POST').then((pubkey) => this.giftCardsService.create(pubkey, body));
  }

  @Get('mine')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  mine(@Headers('authorization') auth: string, @Req() req: Request) {
    return this.resolvePubkey(req, auth, 'GET').then((pubkey) => this.giftCardsService.listMine(pubkey));
  }

  @Get(':code/balance')
  balance(@Param('code') code: string) {
    return this.giftCardsService.getBalance(code);
  }

  @Post(':code/fund')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  fund(
    @Headers('authorization') auth: string,
    @Req() req: Request,
    @Param('code') code: string,
    @Body() body: SetGiftCardFundedDto,
  ) {
    return this.resolvePubkey(req, auth, 'POST').then((pubkey) => this.giftCardsService.markFunded(pubkey, code, body.paymentRef));
  }

  @Post(':code/redeem')
  redeem(@Param('code') code: string, @Body() body: RedeemGiftCardDto) {
    return this.giftCardsService.redeem(code, body);
  }
}
