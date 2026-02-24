import { Controller, Get, Post, Delete, Body, Headers, Req, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { AuthService } from '../auth/auth.service';
import { Request } from 'express';
import { CreateApiKeyDto } from './dto/api-keys.dto';

@ApiTags('api-keys')
@Controller('api/v1/api-keys')
export class ApiKeysController {
  constructor(
    private apiKeysService: ApiKeysService,
    private authService: AuthService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new API key (Business tier only)' })
  @ApiResponse({ status: 201, description: 'API key created - key is only shown once!' })
  @ApiResponse({ status: 403, description: 'Business tier required' })
  async createApiKey(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
    @Body() body: CreateApiKeyDto,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'POST', url);
    
    return this.apiKeysService.createApiKey(
      pubkey,
      body.name,
      body.permissions,
      body.expiresAt ? new Date(body.expiresAt) : undefined,
    );
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all API keys' })
  @ApiResponse({ status: 200, description: 'List of API keys' })
  async listApiKeys(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'GET', url);
    
    return this.apiKeysService.listApiKeys(pubkey);
  }

  @Get(':id/usage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get API key usage statistics' })
  @ApiResponse({ status: 200, description: 'Usage statistics' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async getUsage(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
    @Param('id') keyId: string,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'GET', url);
    
    return this.apiKeysService.getApiKeyUsage(pubkey, keyId);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiResponse({ status: 200, description: 'API key revoked' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async revokeApiKey(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
    @Param('id') keyId: string,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'DELETE', url);
    
    await this.apiKeysService.revokeApiKey(pubkey, keyId);
    return { revoked: true };
  }
}
