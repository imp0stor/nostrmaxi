import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('api-keys')
@Controller('api/v1/api-keys')
@UseGuards(NostrJwtAuthGuard)
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new API key (Business tier only)' })
  @ApiResponse({ status: 201, description: 'API key created - key is only shown once!' })
  @ApiResponse({ status: 403, description: 'Business tier required' })
  async createApiKey(
    @CurrentUser() pubkey: string,
    @Body() body: { name: string; permissions?: string[]; expiresAt?: string },
  ) {
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
  async listApiKeys(@CurrentUser() pubkey: string) {
    return this.apiKeysService.listApiKeys(pubkey);
  }

  @Get(':id/usage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get API key usage statistics' })
  @ApiResponse({ status: 200, description: 'Usage statistics' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async getUsage(
    @CurrentUser() pubkey: string,
    @Param('id') keyId: string,
  ) {
    return this.apiKeysService.getApiKeyUsage(pubkey, keyId);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiResponse({ status: 200, description: 'API key revoked' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async revokeApiKey(
    @CurrentUser() pubkey: string,
    @Param('id') keyId: string,
  ) {
    await this.apiKeysService.revokeApiKey(pubkey, keyId);
    return { revoked: true };
  }
}
