import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import { AuctionService } from '../auctions/auction.service';
import { BTCPayProvider } from './btcpay.provider';

@Controller('api/v1/payments')
export class PaymentController {
  private readonly btcpayProvider: BTCPayProvider;

  constructor(private readonly auctionService: AuctionService) {
    this.btcpayProvider = new BTCPayProvider({
      url: process.env.BTCPAY_URL || '',
      apiKey: process.env.BTCPAY_API_KEY || '',
      storeId: process.env.BTCPAY_STORE_ID || '',
      webhookSecret: process.env.BTCPAY_WEBHOOK_SECRET,
    });
  }

  @Post('/webhooks/btcpay')
  @HttpCode(200)
  async handleBTCPayWebhook(
    @Body() payload: any,
    @Headers('btcpay-sig') signature?: string,
  ): Promise<{ ok: boolean }> {
    const rawBody = JSON.stringify(payload);
    const verified = this.btcpayProvider.verifyWebhookSignature(rawBody, signature);

    if (!verified) {
      throw new BadRequestException('Invalid BTCPay webhook signature');
    }

    const event = this.btcpayProvider.parseWebhook(payload);
    if (event?.status === 'paid') {
      await this.auctionService.handlePaymentReceived(event.invoiceId);
    }

    return { ok: true };
  }
}
