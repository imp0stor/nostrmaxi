import { PaymentProvider, PaymentProviderType, PaymentInvoiceRequest, PaymentInvoiceResponse, PaymentStatus, PaymentWebhookEvent } from './payment-provider';

export class LndProvider implements PaymentProvider {
  readonly type: PaymentProviderType = 'lnd';

  constructor(
    private readonly config: {
      grpcHost: string;
      grpcPort: number;
      tlsCertPath?: string;
      macaroonPath?: string;
      macaroonHex?: string;
    },
  ) {}

  async createInvoice(request: PaymentInvoiceRequest): Promise<PaymentInvoiceResponse> {
    // TODO: Implement LND AddInvoice (gRPC)
    throw new Error('LndProvider.createInvoice not implemented');
  }

  async getInvoiceStatus(providerInvoiceId: string, _paymentHash?: string): Promise<PaymentStatus> {
    // TODO: Implement LND LookupInvoice (gRPC)
    throw new Error('LndProvider.getInvoiceStatus not implemented');
  }

  parseWebhookEvent(_payload: any): PaymentWebhookEvent | null {
    // LND does not provide webhooks; use Invoice subscription stream instead.
    return null;
  }
}
