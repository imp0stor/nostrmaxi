import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { EndorseSkillDto } from './dto/endorse-skill.dto';
import { UpdateProfileThemeDto } from './dto/update-profile-theme.dto';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';

@Controller('api/v1/profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(':pubkey')
  async getProfileSummary(@Param('pubkey') pubkey: string) {
    const resolvedPubkey = await this.profilesService.resolvePubkey(pubkey);
    return this.profilesService.getProfileSummary(resolvedPubkey);
  }

  @Get(':pubkey/endorsements')
  async getEndorsements(@Param('pubkey') pubkey: string) {
    const resolvedPubkey = await this.profilesService.resolvePubkey(pubkey);
    return this.profilesService.getEndorsements(resolvedPubkey);
  }

  @UseGuards(NostrJwtAuthGuard)
  @Post(':pubkey/endorse')
  async endorse(@Req() req: any, @Param('pubkey') pubkey: string, @Body() dto: EndorseSkillDto) {
    const resolvedPubkey = await this.profilesService.resolvePubkey(pubkey);
    return this.profilesService.endorseSkill(req.pubkey, resolvedPubkey, dto);
  }

  @UseGuards(NostrJwtAuthGuard)
  @Patch(':pubkey')
  async patchProfile(@Req() req: any, @Param('pubkey') pubkey: string, @Body() dto: UpdateProfileThemeDto) {
    const resolvedPubkey = await this.profilesService.resolvePubkey(pubkey);
    if (req.pubkey !== resolvedPubkey) {
      return { updated: false, message: 'Cannot update another profile' };
    }

    if (!dto.theme) {
      return { updated: false, message: 'No supported profile fields provided' };
    }

    const settings = await this.profilesService.updateTheme(resolvedPubkey, dto.theme);
    return { updated: true, theme: settings.theme };
  }
}
