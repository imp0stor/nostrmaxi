import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Decorator to extract the current user's pubkey from request
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const pubkey = (request as any).pubkey;

    if (!pubkey) {
      throw new Error('No pubkey in request context. Did you forget to use NostrAuthGuard?');
    }

    return pubkey;
  },
);
