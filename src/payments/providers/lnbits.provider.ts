import * as crypto from 'crypto';
import {
  PaymentProvider,
  PaymentProviderType,
  PaymentInvoiceRequest,
  PaymentInvoiceResponse,
  PaymentStatus,
  PaymentWebhookEvent,
} from './payment-provider';

export class LnbitsProvider implements PaymentProvider {
  readonly type: PaymentProviderType = 'lnbits';

  constructor(
    private readonly config: {
      baseUrl: string;
      apiKey: string;
      webhookSecret?: string;
    },
  ) {}

  async createInvoice(request: PaymentInvoiceRequest): Promise<PaymentInvoiceResponse> {
    if (!this.config.apiKey) {
      const mockHash = crypto.randomBytes(32).toString('hex');
      return {
        provider: this.type,
        providerInvoiceId: mockHash,
        paymentHash: mockHash,
        bolt11: `lnbc${request.amountSats}n1pnmock...${mockHash.slice(0, 16)}`,
        expiresAt: request.expiresInSeconds
          ? new Date(Date.now() + request.expiresInSeconds * 1000)
          : undefined,
        raw: { mock: true },
      };
    }

    const response = await fetch(`${this.config.baseUrl}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.config.apiKey,
      },
      body: JSON.stringify({
        out: false,
        amount: request.amountSats,
        memo: request.memo,
        expiry: request.expiresInSeconds ?? 600,
        webhook: request.webhookUrl,
        extra: request.metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LNbits error: ${error}`);
    }

    const data = await response.json();

    return {
      provider: this.type,
      providerInvoiceId: data.checking_id,
      paymentHash: data.payment_hash,
      bolt11: data.payment_request,
      expiresAt: request.expiresInSeconds
        ? new Date(Date.now() + request.expiresInSeconds * 1000)
        : undefined,
      raw: data,
    };
  }

  async getInvoiceStatus(providerInvoiceId: string, paymentHash?: string): Promise<PaymentStatus> {
    if (!this.config.apiKey) {
      return {
        provider: this.type,
        providerInvoiceId,
        state: 'pending',
        raw: { mock: true },
      };
    }

    const lookupId = paymentHash || providerInvoiceId;

    const response = await fetch(`${this.config.baseUrl}/api/v1/payments/${lookupId}`, {
      headers: {
        'X-Api-Key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      return {
        provider: this.type,
        providerInvoiceId,
        state: 'unknown',
      };
    }

    const data = await response.json();
    const paid = data.paid === true;
    const pending = data.pending === true;

    return {
      provider: this.type,
      providerInvoiceId,
      state: paid ? 'paid' : pending ? 'pending' : 'unknown',
      paidAt: paid && data?.time ? new Date(data.time * 1000) : undefined,
      raw: data,
    };
  }

  parseWebhookEvent(payload: any): PaymentWebhookEvent | null {
    const paymentHash = payload?.payment_hash || payload?.paymentHash;
    const providerInvoiceId = payload?.checking_id || paymentHash;

    if (!providerInvoiceId) {
      return null;
    }

    const paid = payload?.paid === true || payload?.status === 'paid';
    const pending = payload?.pending === true || payload?.status === 'pending';

    return {
      provider: this.type,
      providerInvoiceId,
      paymentHash,
      state: paid ? 'paid' : pending ? 'pending' : undefined,
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

    const payloadString = payload?.payment_hash || payload?.paymentHash || JSON.stringify(payload);
    const expected = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payloadString)
      .digest('hex');

    return signature === expected || signature === `sha256=${expected}`;
  }
}
