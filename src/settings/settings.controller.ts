import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SettingsService, AppSettings } from './settings.service';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';
import { NostrAdminGuard } from '../auth/nostr-role.guard';

@ApiTags('settings')
@Controller('api/v1/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  @ApiOperation({ summary: 'Get public app settings for frontend rendering' })
  @ApiResponse({ status: 200, description: 'Public settings returned' })
  async getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  @Get('admin')
  @UseGuards(NostrJwtAuthGuard, NostrAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get full app settings (admin)' })
  @ApiResponse({ status: 200, description: 'Full settings returned' })
  async getAdminSettings() {
    return this.settingsService.getSettings();
  }

  @Put('admin')
  @UseGuards(NostrJwtAuthGuard, NostrAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update app settings (admin)' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  async updateAdminSettings(@Body() patch: Partial<AppSettings>) {
    return this.settingsService.updateSettings(patch);
  }
}
