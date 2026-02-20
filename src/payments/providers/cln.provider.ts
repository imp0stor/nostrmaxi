import { PaymentProvider, PaymentProviderType, PaymentInvoiceRequest, PaymentInvoiceResponse, PaymentStatus, PaymentWebhookEvent } from './payment-provider';

export class ClnProvider implements PaymentProvider {
  readonly type: PaymentProviderType = 'cln';

  constructor(
    private readonly config: {
      rpcSocketPath?: string;
      restHost?: string;
      restPort?: number;
      rune?: string;
    },
  ) {}

  async createInvoice(request: PaymentInvoiceRequest): Promise<PaymentInvoiceResponse> {
    // TODO: Implement CLN invoice creation (commando/rpc or REST)
    throw new Error('ClnProvider.createInvoice not implemented');
  }

  async getInvoiceStatus(providerInvoiceId: string, _paymentHash?: string): Promise<PaymentStatus> {
    // TODO: Implement CLN invoice status lookup
    throw new Error('ClnProvider.getInvoiceStatus not implemented');
  }

  parseWebhookEvent(_payload: any): PaymentWebhookEvent | null {
    // CLN does not provide webhooks by default; use plugin or polling.
    return null;
  }
}
