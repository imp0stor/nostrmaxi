import { Test, TestingModule } from '@nestjs/testing';
import { Nip05Controller } from '../nip05/nip05.controller';
import { Nip05Service } from '../nip05/nip05.service';
import { AuthService } from '../auth/auth.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { generateTestKeypair } from './helpers/test-utils';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';

describe('E2E registration + verification flows', () => {
  let controller: Nip05Controller;
  const nip05Service = {
    provision: jest.fn(),
    lookup: jest.fn(),
    verifyDomain: jest.fn(),
  } as any;

  const authService = {
    verifyAuth: jest.fn(),
  } as any;

  const webhooks = {
    emit: jest.fn(),
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [Nip05Controller],
      providers: [
        { provide: Nip05Service, useValue: nip05Service },
        { provide: AuthService, useValue: authService },
        { provide: WebhooksService, useValue: webhooks },
        { provide: Reflector, useValue: new Reflector() },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn().mockResolvedValue(0),
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get(Nip05Controller);
  });

  it('register flow: npub + address provisions identity and emits webhook', async () => {
    const kp = generateTestKeypair();

    nip05Service.provision.mockResolvedValue({
      address: 'alice@nostrmaxi.com',
      pubkey: kp.pubkey,
      relays: ['wss://relay.damus.io'],
    });

    const result = await controller.register({
      address: 'alice@nostrmaxi.com',
      npub: kp.pubkey,
      callbackUrl: 'https://hooks.test/nostrmaxi',
    } as any);

    expect(nip05Service.provision).toHaveBeenCalledWith(kp.pubkey, 'alice', 'nostrmaxi.com');
    expect(webhooks.emit).toHaveBeenCalledWith(
      'subscription.changed',
      expect.objectContaining({ type: 'nip05.registered', address: 'alice@nostrmaxi.com' }),
      'https://hooks.test/nostrmaxi',
    );
    expect(result.address).toBe('alice@nostrmaxi.com');
  });

  it('verification flow: resolves owner pubkey and verifies custom domain', async () => {
    authService.verifyAuth.mockResolvedValue('b'.repeat(64));
    nip05Service.verifyDomain.mockResolvedValue({ domain: 'identity.example.com', verified: true });

    const req = {
      protocol: 'https',
      get: jest.fn(() => 'nostrmaxi.strangesignal.ai'),
      originalUrl: '/api/v1/nip05/verify/identity.example.com',
    } as any;

    const result = await controller.verifyDomain('Nostr token', req, 'identity.example.com');

    expect(authService.verifyAuth).toHaveBeenCalled();
    expect(nip05Service.verifyDomain).toHaveBeenCalledWith('b'.repeat(64), 'identity.example.com');
    expect(result.verified).toBe(true);
  });
});
