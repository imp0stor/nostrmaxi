import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AnalyticsController } from '../analytics/analytics.controller';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';

describe('AnalyticsController guard wiring', () => {
  it('applies EntitlementGuard at controller level', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AnalyticsController) as any[] | undefined;
    expect(Array.isArray(guards)).toBe(true);
    expect(guards).toContain(EntitlementGuard);
  });
});
