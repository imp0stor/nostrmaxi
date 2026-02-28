import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import {
  Invoice,
  InvoiceStatus,
  Payment,
  PaymentProvider,
} from './payment-provider.interface';

export class BTCPayProvider implements PaymentProvider {
  private subscribers: Array<(payment: Payment) => void> = [];

  constructor(
    private readonly config: {
      url: string;
      apiKey: string;
      storeId: string;
      webhookSecret?: string;
    },
  ) {}

  async createInvoice(amount: number, memo: string, metadata: any): Promise<Invoice> {
    if (!this.config.apiKey) {
      return {
        id: randomUUID(),
        amount,
        memo,
        bolt11: `lnbc${amount}n1pbtcpaymock`,
        backend: 'btcpay',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        metadata,
      };
    }

    const response = await fetch(`${this.config.url}/api/v1/stores/${this.config.storeId}/invoices`, {
      method: 'POST',
      headers: {
        Authorization: `token ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Number((amount / 100_000_000).toFixed(8)),
        currency: 'BTC',
        metadata: {
          orderId: metadata?.orderId,
          itemDesc: memo,
          ...metadata,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`BTCPay invoice creation failed: ${await response.text()}`);
    }

    const data = await response.json();

    return {
      id: data.id,
      amount,
      memo,
      bolt11: data?.paymentMethods?.['BTC-LightningNetwork']?.destination || '',
      backend: 'btcpay',
      expiresAt: data.expirationTime ? new Date(data.expirationTime) : undefined,
      metadata,
    };
  }

  async checkInvoiceStatus(invoiceId: string): Promise<InvoiceStatus> {
    if (!this.config.apiKey) {
      return 'pending';
    }

    const response = await fetch(
      `${this.config.url}/api/v1/stores/${this.config.storeId}/invoices/${invoiceId}`,
      {
        headers: {
          Authorization: `token ${this.config.apiKey}`,
        },
      },
    );

    if (!response.ok) {
      return 'failed';
    }

    const data = await response.json();
    const status = String(data.status || '').toLowerCase();
    if (status === 'settled') return 'paid';
    if (status === 'expired') return 'expired';
    if (status === 'invalid') return 'failed';
    return 'pending';
  }

  subscribeToPayments(callback: (payment: Payment) => void): void {
    this.subscribers.push(callback);
  }

  verifyWebhookSignature(rawBody: string, signature?: string): boolean {
    if (!this.config.webhookSecret) return true;
    if (!signature) return false;

    const expected = createHmac('sha256', this.config.webhookSecret).update(rawBody).digest('hex');
    const normalized = signature.startsWith('sha256=') ? signature.slice(7) : signature;

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const givenBuffer = Buffer.from(normalized, 'utf8');
    if (expectedBuffer.length !== givenBuffer.length) return false;

    return timingSafeEqual(expectedBuffer, givenBuffer);
  }

  parseWebhook(payload: any): Payment | null {
    const invoiceId = payload?.invoiceId || payload?.id;
    const eventType = String(payload?.type || payload?.eventType || '').toLowerCase();
    if (!invoiceId || !eventType) return null;

    let status: InvoiceStatus = 'pending';
    if (eventType.includes('settled')) status = 'paid';
    else if (eventType.includes('expired')) status = 'expired';
    else if (eventType.includes('invalid')) status = 'failed';

    const payment: Payment = {
      invoiceId,
      status,
      metadata: payload,
      paidAt: status === 'paid' ? new Date() : undefined,
    };

    if (status === 'paid') {
      this.subscribers.forEach((subscriber) => subscriber(payment));
    }

    return payment;
  }
}
