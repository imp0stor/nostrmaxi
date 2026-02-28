import { Injectable } from '@nestjs/common';
import { UserAnalyticsService } from './user-analytics.service';

/**
 * Backward-compatible alias for the legacy single-scope analytics service.
 * Prefer UserAnalyticsService and the scope services for new code.
 */
@Injectable()
export class AnalyticsService extends UserAnalyticsService {}
