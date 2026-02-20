import { Controller, Get, Query, Headers, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AuthService } from '../auth/auth.service';
import { Request } from 'express';

@ApiTags('admin')
@Controller('api/v1/admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private authService: AuthService,
  ) {}

  private async requireAdmin(authHeader: string, method: string, url: string) {
    const pubkey = await this.authService.verifyNip98Auth(authHeader, method, url);
    this.adminService.requireAdmin(pubkey);
    return pubkey;
  }

  @Get('stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard stats' })
  @ApiResponse({ status: 403, description: 'Not an admin' })
  async getStats(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    await this.requireAdmin(authHeader, 'GET', url);
    return this.adminService.getStats();
  }

  @Get('users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'User list' })
  async listUsers(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    await this.requireAdmin(authHeader, 'GET', url);
    return this.adminService.listUsers(
      page ? parseInt(page) : undefined,
      limit ? parseInt(limit) : undefined,
    );
  }

  @Get('nip05s')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all NIP-05 identities' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'NIP-05 list' })
  async listNip05s(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    await this.requireAdmin(authHeader, 'GET', url);
    return this.adminService.listNip05s(
      page ? parseInt(page) : undefined,
      limit ? parseInt(limit) : undefined,
    );
  }

  @Get('audit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get audit log' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Audit log' })
  async getAuditLog(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    await this.requireAdmin(authHeader, 'GET', url);
    return this.adminService.getAuditLog(
      page ? parseInt(page) : undefined,
      limit ? parseInt(limit) : undefined,
    );
  }

  @Get('payments')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment history' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Payment list' })
  async getPayments(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    await this.requireAdmin(authHeader, 'GET', url);
    return this.adminService.getPayments(
      page ? parseInt(page) : undefined,
      limit ? parseInt(limit) : undefined,
    );
  }
}
