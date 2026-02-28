import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Event as NostrEvent, type SimplePool as SimplePoolType } from 'nostr-tools';

// Enable WebSocket for Node.js - must import SimplePool from same module
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const { useWebSocketImplementation, SimplePool } = require('nostr-tools/pool') as {
  useWebSocketImplementation: (ws: unknown) => void;
  SimplePool: new () => SimplePoolType;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
useWebSocketImplementation(require('ws'));
import { RetentionPolicy } from '../sync/sync-priority.service';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly pool = new SimplePool();
  private readonly localRelay: string;

  constructor(private readonly configService: ConfigService) {
    this.localRelay = this.configService.get('LOCAL_RELAY_URL') || 'ws://localhost:7777';
  }

  async syncEvent(event: NostrEvent, retention: RetentionPolicy): Promise<void> {
    try {
      await this.pool.publish([this.localRelay], {
        ...event,
        tags: [...(event.tags || []), ['retention', retention]],
      } as any);
    } catch (error) {
      this.logger.warn(`Failed to sync event ${event.id}: ${(error as Error).message}`);
    }
  }
}
