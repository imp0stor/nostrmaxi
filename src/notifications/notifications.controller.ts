import { Controller, Get, NotFoundException, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('api/v1/notifications')
@UseGuards(NostrJwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Notification list returned' })
  async list(
    @CurrentUser() pubkey: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.notificationsService.list(pubkey, limit ?? 50);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count returned' })
  async unreadCount(@CurrentUser() pubkey: string) {
    const unread = await this.notificationsService.unreadCount(pubkey);
    return { unread };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markRead(@CurrentUser() pubkey: string, @Param('id') id: string) {
    const item = await this.notificationsService.markRead(pubkey, id);
    if (!item) {
      throw new NotFoundException('Notification not found');
    }
    return item;
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'Unread notifications marked read' })
  async markAllRead(@CurrentUser() pubkey: string) {
    return this.notificationsService.markAllRead(pubkey);
  }
}
