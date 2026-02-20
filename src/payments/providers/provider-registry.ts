import { PaymentProvider, PaymentProviderType } from './payment-provider';
import { BtcpayProvider } from './btcpay.provider';
import { LndProvider } from './lnd.provider';
import { ClnProvider } from './cln.provider';
import { LnbitsProvider } from './lnbits.provider';

export class PaymentProviderRegistry {
  private providers = new Map<PaymentProviderType, PaymentProvider>();

  register(provider: PaymentProvider) {
    this.providers.set(provider.type, provider);
  }

  get(type: PaymentProviderType): PaymentProvider | undefined {
    return this.providers.get(type);
  }

  list(): PaymentProvider[] {
    return Array.from(this.providers.values());
  }

  static fromConfig(config: {
    lnbits?: { baseUrl: string; apiKey: string; webhookSecret?: string };
    btcpay?: { baseUrl: string; apiKey: string; storeId: string; webhookSecret?: string };
    lnd?: { grpcHost: string; grpcPort: number; tlsCertPath?: string; macaroonPath?: string; macaroonHex?: string };
    cln?: { rpcSocketPath?: string; restHost?: string; restPort?: number; rune?: string };
  }): PaymentProviderRegistry {
    const registry = new PaymentProviderRegistry();

    if (config.lnbits) registry.register(new LnbitsProvider(config.lnbits));
    if (config.btcpay) registry.register(new BtcpayProvider(config.btcpay));
    if (config.lnd) registry.register(new LndProvider(config.lnd));
    if (config.cln) registry.register(new ClnProvider(config.cln));

    return registry;
  }
}
