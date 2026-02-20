export type PaymentProviderType = 'lnbits' | 'btcpay' | 'lnd' | 'cln';

export type PaymentStatusState = 'pending' | 'paid' | 'expired' | 'failed' | 'unknown';

export interface PaymentInvoiceRequest {
  amountSats: number;
  memo: string;
  expiresInSeconds?: number;
  webhookUrl?: string;
  metadata?: Record<string, any>;
}

export interface PaymentInvoiceResponse {
  provider: PaymentProviderType;
  providerInvoiceId: string;
  paymentHash?: string;
  bolt11: string;
  expiresAt?: Date;
  raw?: any;
}

export interface PaymentStatus {
  provider: PaymentProviderType;
  providerInvoiceId: string;
  state: PaymentStatusState;
  paidAt?: Date;
  preimage?: string;
  raw?: any;
}

export interface PaymentWebhookEvent {
  provider: PaymentProviderType;
  providerInvoiceId: string;
  paymentHash?: string;
  state?: PaymentStatusState;
  raw: any;
}

export interface PaymentProvider {
  readonly type: PaymentProviderType;
  createInvoice(request: PaymentInvoiceRequest): Promise<PaymentInvoiceResponse>;
  getInvoiceStatus(providerInvoiceId: string, paymentHash?: string): Promise<PaymentStatus>;
  parseWebhookEvent(payload: any): PaymentWebhookEvent | null;
  verifyWebhookSignature?(payload: any, signature?: string): boolean;
}
