import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Request } from 'express';

@Injectable()
export class NostrAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No authorization header');
    }

    try {
      const url = `${request.protocol}://${request.get('host')}${request.originalUrl}`;
      const pubkey = await this.authService.verifyNip98Auth(
        authHeader,
        request.method,
        url,
      );
      
      // Attach pubkey to request for downstream use
      (request as any).pubkey = pubkey;
      return true;
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }
}
