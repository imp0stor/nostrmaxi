export type LightningBackend = 'btcpay' | 'lnd' | 'cln';

export type InvoiceStatus = 'pending' | 'paid' | 'expired' | 'failed';

export interface Invoice {
  id: string;
  amount: number;
  memo: string;
  bolt11: string;
  backend: LightningBackend;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface Payment {
  invoiceId: string;
  status: InvoiceStatus;
  paidAt?: Date;
  metadata?: Record<string, any>;
}

export interface PaymentProvider {
  createInvoice(amount: number, memo: string, metadata: any): Promise<Invoice>;
  checkInvoiceStatus(invoiceId: string): Promise<InvoiceStatus>;
  subscribeToPayments(callback: (payment: Payment) => void): void;
  verifyWebhookSignature?(rawBody: string, signature?: string): boolean;
  parseWebhook?(payload: any): Payment | null;
}
