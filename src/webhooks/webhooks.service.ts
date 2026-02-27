import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type WebhookEventType =
  | 'identity.verification.completed'
  | 'subscription.changed'
  | 'payment.status.updated';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly config: ConfigService) {}

  async emit(eventType: WebhookEventType, payload: Record<string, any>, explicitUrl?: string): Promise<void> {
    const urls = this.resolveTargets(eventType, explicitUrl);
    if (urls.length === 0) return;

    await Promise.all(
      urls.map(async (url) => {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-nostrmaxi-event': eventType,
            },
            body: JSON.stringify({
              event: eventType,
              timestamp: new Date().toISOString(),
              data: payload,
            }),
          });

          if (!res.ok) {
            this.logger.warn(`Webhook ${eventType} failed for ${url}: HTTP ${res.status}`);
          }
        } catch (error: any) {
          this.logger.warn(`Webhook ${eventType} failed for ${url}: ${error?.message || error}`);
        }
      }),
    );
  }

  private resolveTargets(eventType: WebhookEventType, explicitUrl?: string): string[] {
    const fromRequest = explicitUrl ? [explicitUrl] : [];

    const envKeyByEvent: Record<WebhookEventType, string> = {
      'identity.verification.completed': 'WEBHOOK_IDENTITY_VERIFICATION_URLS',
      'subscription.changed': 'WEBHOOK_SUBSCRIPTION_CHANGE_URLS',
      'payment.status.updated': 'WEBHOOK_PAYMENT_STATUS_URLS',
    };

    const fromEnv = (this.config.get<string>(envKeyByEvent[eventType]) || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    const unique = [...new Set([...fromRequest, ...fromEnv])];
    return unique;
  }
}
