import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly defaultLimit: number;
  private readonly defaultTtl: number;  // seconds

  constructor(
    private reflector: Reflector,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.defaultLimit = parseInt(process.env.RATE_LIMIT_MAX || '100');
    this.defaultTtl = parseInt(process.env.RATE_LIMIT_TTL || '60');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = this.getKey(request);
    
    // Get current count
    let current: number = (await this.cacheManager.get(key)) || 0;
    
    // Increment
    current++;
    
    // Store with TTL (in milliseconds)
    await this.cacheManager.set(key, current, this.defaultTtl * 1000);
    
    if (current > this.defaultLimit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter: this.defaultTtl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    
    return true;
  }

  private getKey(request: any): string {
    const ip = request.ip || request.connection.remoteAddress;
    const path = request.route?.path || request.url;
    
    // Use pubkey for authenticated requests (more generous limits possible)
    const pubkey = (request as any).pubkey;
    if (pubkey) {
      return `ratelimit:user:${pubkey}:${path}`;
    }
    
    // IP-based for unauthenticated
    return `ratelimit:ip:${ip}:${path}`;
  }
}
