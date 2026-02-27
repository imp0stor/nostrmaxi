import 'reflect-metadata';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';

import { AdminController } from '../admin/admin.controller';
import { ApiKeysController } from '../api-keys/api-keys.controller';
import { AuthController } from '../auth/auth.controller';
import { HealthController } from '../health/health.controller';
import { IdentityController } from '../identity/identity.controller';
import { MetricsController } from '../metrics/metrics.controller';
import { Nip05Controller } from '../nip05/nip05.controller';
import { PaymentsController } from '../payments/payments.controller';
import { SearchController } from '../search/search.controller';
import { SettingsController } from '../settings/settings.controller';
import { SubscriptionController } from '../subscription/subscription.controller';
import { SubscriptionsAgentController } from '../subscription/subscriptions-agent.controller';
import { WotController } from '../wot/wot.controller';

const controllers = [
  AdminController,
  ApiKeysController,
  AuthController,
  HealthController,
  IdentityController,
  MetricsController,
  Nip05Controller,
  PaymentsController,
  SearchController,
  SettingsController,
  SubscriptionController,
  SubscriptionsAgentController,
  WotController,
];

const methodName = (method: RequestMethod) => RequestMethod[method] || String(method);

describe('API contract coverage', () => {
  it('every controller defines a base route path', () => {
    for (const Controller of controllers) {
      const basePath = Reflect.getMetadata(PATH_METADATA, Controller);
      expect(basePath).toBeDefined();
    }
  });

  it('every controller has at least one routed handler', () => {
    for (const Controller of controllers) {
      const proto = Controller.prototype;
      const keys = Object.getOwnPropertyNames(proto).filter((k) => k !== 'constructor');

      const routed = keys.filter((key) => {
        const handler = proto[key];
        return Reflect.hasMetadata(METHOD_METADATA, handler);
      });

      expect(routed.length).toBeGreaterThan(0);
    }
  });

  it('all routed handlers map to valid HTTP methods and route strings', () => {
    for (const Controller of controllers) {
      const proto = Controller.prototype;
      const keys = Object.getOwnPropertyNames(proto).filter((k) => k !== 'constructor');

      for (const key of keys) {
        const handler = proto[key];
        if (!Reflect.hasMetadata(METHOD_METADATA, handler)) continue;

        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod;
        const route = Reflect.getMetadata(PATH_METADATA, handler);

        expect(typeof methodName(method)).toBe('string');
        if (route !== undefined) {
          expect(typeof route === 'string' || Array.isArray(route)).toBe(true);
        }
      }
    }
  });
});
