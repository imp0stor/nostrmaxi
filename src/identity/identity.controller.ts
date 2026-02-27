import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IdentityService } from './identity.service';
import { BatchVerifyIdentityDto, VerifyIdentityDto } from './dto/identity.dto';

@ApiTags('identity')
@Controller('api/v1/identity')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('verify')
  @ApiOperation({ summary: 'Verify a Nostr identity using WoT score' })
  @ApiResponse({ status: 201, description: 'Verification result' })
  verify(@Body() dto: VerifyIdentityDto) {
    return this.identityService.verifyIdentity(dto);
  }

  @Post('batch-verify')
  @ApiOperation({ summary: 'Verify multiple Nostr identities in one request' })
  @ApiResponse({ status: 201, description: 'Batch verification results' })
  async batchVerify(@Body() dto: BatchVerifyIdentityDto) {
    const results = await Promise.all(dto.identities.map((identity) => this.identityService.verifyIdentity(identity)));
    return { count: results.length, results };
  }

  @Get(':npub')
  @ApiOperation({ summary: 'Get identity profile by npub (or hex pubkey)' })
  @ApiResponse({ status: 200, description: 'Identity profile' })
  getIdentity(@Param('npub') npub: string) {
    return this.identityService.getIdentity(npub);
  }
}
