import { UserSyncService } from '../sync/user-sync.service';

describe('UserSyncService login policy', () => {
  it('always delta-syncs on login for any logged-in user', async () => {
    const fakeService = {
      deltaSyncUserNotes: jest.fn().mockResolvedValue({
        synced: 0,
        alreadyHad: 0,
        failed: 0,
        oldestEvent: null,
        newestEvent: null,
      }),
    } as unknown as UserSyncService;

    await UserSyncService.prototype.onUserLogin.call(fakeService, 'pubkey123');

    expect(fakeService.deltaSyncUserNotes).toHaveBeenCalledWith('pubkey123');
  });
});
