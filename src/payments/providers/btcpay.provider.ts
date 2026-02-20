import * as crypto from 'crypto';
import {
  PaymentProvider,
  PaymentProviderType,
  PaymentInvoiceRequest,
  PaymentInvoiceResponse,
  PaymentStatus,
  PaymentWebhookEvent,
} from './payment-provider';

export class BtcpayProvider implements PaymentProvider {
  readonly type: PaymentProviderType = 'btcpay';

  constructor(
    private readonly config: {
      baseUrl: string;
      apiKey: string;
      storeId: string;
      webhookSecret?: string;
    },
  ) {}

  async createInvoice(request: PaymentInvoiceRequest): Promise<PaymentInvoiceResponse> {
    if (!this.config.apiKey) {
      const mockId = crypto.randomBytes(12).toString('hex');
      return {
        provider: this.type,
        providerInvoiceId: mockId,
        bolt11: `lnbc${request.amountSats}n1pnbtcpaymock...${mockId.slice(0, 10)}`,
        expiresAt: request.expiresInSeconds
          ? new Date(Date.now() + request.expiresInSeconds * 1000)
          : undefined,
        raw: { mock: true },
      };
    }

    const response = await fetch(
      `${this.config.baseUrl}/api/v1/stores/${this.config.storeId}/invoices`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `token ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          amount: Number((request.amountSats / 100_000_000).toFixed(8)),
          currency: 'BTC',
          metadata: request.metadata,
          checkout: request.expiresInSeconds
            ? { expirationMinutes: Math.ceil(request.expiresInSeconds / 60) }
            : undefined,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`BTCPay error: ${error}`);
    }

    const data = await response.json();
    const bolt11 = await this.fetchLightningInvoice(data.id);

    return {
      provider: this.type,
      providerInvoiceId: data.id,
      bolt11: bolt11 || data?.paymentMethods?.['BTC-LightningNetwork']?.destination || '',
      expiresAt: request.expiresInSeconds
        ? new Date(Date.now() + request.expiresInSeconds * 1000)
        : undefined,
      raw: data,
    };
  }

  async getInvoiceStatus(providerInvoiceId: string): Promise<PaymentStatus> {
    if (!this.config.apiKey) {
      return {
        provider: this.type,
        providerInvoiceId,
        state: 'pending',
        raw: { mock: true },
      };
    }

    const response = await fetch(
      `${this.config.baseUrl}/api/v1/stores/${this.config.storeId}/invoices/${providerInvoiceId}`,
      {
        headers: {
          Authorization: `token ${this.config.apiKey}`,
        },
      },
    );

    if (!response.ok) {
      return {
        provider: this.type,
        providerInvoiceId,
        state: 'unknown',
      };
    }

    const data = await response.json();
    const status = (data.status || '').toString();

    let state: PaymentStatus['state'] = 'pending';
    if (status.toLowerCase() === 'settled') state = 'paid';
    else if (status.toLowerCase() === 'expired') state = 'expired';
    else if (status.toLowerCase() === 'invalid') state = 'failed';

    const paidAtValue = data.paidTime || data.paidAt || data.paidDate;

    return {
      provider: this.type,
      providerInvoiceId,
      state,
      paidAt: paidAtValue ? new Date(paidAtValue) : undefined,
      raw: data,
    };
  }

  parseWebhookEvent(payload: any): PaymentWebhookEvent | null {
    const invoiceId = payload?.invoiceId || payload?.id;
    const type = payload?.type || payload?.event || payload?.eventType;

    if (!invoiceId || !type) {
      return null;
    }

    let state: PaymentWebhookEvent['state'];
    const normalized = type.toString().toLowerCase();
    if (normalized.includes('settled')) state = 'paid';
    else if (normalized.includes('expired')) state = 'expired';
    else if (normalized.includes('invalid')) state = 'failed';

    return {
      provider: this.type,
      providerInvoiceId: invoiceId,
      state,
      raw: payload,
    };
  }

  verifyWebhookSignature(payload: any, signature?: string): boolean {
    if (!this.config.webhookSecret) {
      return true;
    }

    if (!signature) {
      return false;
    }

    const raw = JSON.stringify(payload);
    const expected = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(raw)
      .digest('hex');

    const normalized = signature.startsWith('sha256=') ? signature.slice(7) : signature;

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(normalized);

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  }

  private async fetchLightningInvoice(invoiceId: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/stores/${this.config.storeId}/invoices/${invoiceId}/payment-methods`,
        {
          headers: {
            Authorization: `token ${this.config.apiKey}`,
          },
        },
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const methods = Array.isArray(data) ? data : Object.values(data || {});
      const lightning = methods.find((method: any) => {
        const type = (method?.paymentMethod || method?.id || '').toString();
        return type.toLowerCase().includes('lightning');
      });

      return lightning?.destination || lightning?.bolt11 || lightning?.paymentLink || null;
    } catch (_error) {
      return null;
    }
  }
}
