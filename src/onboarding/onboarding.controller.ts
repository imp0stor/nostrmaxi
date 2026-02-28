import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';

@ApiTags('onboarding')
@Controller('api/v1/onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('relay-suggestions')
  @ApiOperation({ summary: 'Get smart relay suggestions for onboarding' })
  @ApiResponse({ status: 200, description: 'Relay suggestions and preselected defaults' })
  getRelaySuggestions() {
    return this.onboardingService.getRelaySuggestions();
  }

  @Get('follow-categories')
  @ApiOperation({ summary: 'Get categorized follow suggestions for onboarding' })
  @ApiResponse({ status: 200, description: 'Follow categories with curated profiles' })
  getFollowCategories() {
    return this.onboardingService.getFollowCategories();
  }

  @Get('feeds')
  @ApiOperation({ summary: 'Get curated feed definitions for onboarding' })
  @ApiResponse({ status: 200, description: 'Curated feed list and sample posts' })
  getFeeds() {
    return this.onboardingService.getFeeds();
  }

  @Post('complete')
  @ApiOperation({ summary: 'Finalize onboarding and prepare NIP-51 feed list payload' })
  @ApiResponse({ status: 201, description: 'Onboarding completion summary' })
  completeOnboarding(@Body() payload: any) {
    return this.onboardingService.complete(payload);
  }
}
