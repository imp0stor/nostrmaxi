import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NotificationsService } from '../notifications/notifications.service';

describe('NotificationsService', () => {
  let tempDir: string;
  let service: NotificationsService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'nostrmaxi-notifications-'));
    service = new NotificationsService(join(tempDir, 'notifications.json'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test('seeds defaults and returns unread count', async () => {
    const pubkey = 'pubkey-1';

    const list = await service.list(pubkey);
    expect(list.length).toBeGreaterThan(0);

    const unread = await service.unreadCount(pubkey);
    expect(unread).toBe(list.filter((item) => !item.readAt).length);
    expect(unread).toBeGreaterThan(0);
  });

  test('marks one notification read', async () => {
    const pubkey = 'pubkey-2';
    const [first] = await service.list(pubkey);

    const updated = await service.markRead(pubkey, first.id);
    expect(updated).toBeTruthy();
    expect(updated?.readAt).toBeTruthy();

    const unread = await service.unreadCount(pubkey);
    expect(unread).toBeGreaterThanOrEqual(0);
    expect(unread).toBeLessThan((await service.list(pubkey)).length);
  });

  test('marks all unread notifications read', async () => {
    const pubkey = 'pubkey-3';
    await service.list(pubkey);

    const result = await service.markAllRead(pubkey);
    expect(result.marked).toBeGreaterThan(0);

    const unread = await service.unreadCount(pubkey);
    expect(unread).toBe(0);
  });
});
