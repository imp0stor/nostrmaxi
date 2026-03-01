import { NotificationsService } from '../notifications/notifications.service';

describe('NotificationsService', () => {
  function setup() {
    const rows: any[] = [];
    const prisma = {
      notification: {
        create: jest.fn(async ({ data }: any) => {
          const row = {
            id: `n_${rows.length + 1}`,
            ...data,
            read: false,
            createdAt: new Date(),
          };
          rows.push(row);
          return row;
        }),
        findMany: jest.fn(async ({ where, take }: any) => {
          return rows
            .filter((row) => row.userPubkey === where.userPubkey && (!where.read || row.read === where.read))
            .slice(0, take);
        }),
        count: jest.fn(async ({ where }: any) => rows.filter((row) => row.userPubkey === where.userPubkey && row.read === where.read).length),
        findFirst: jest.fn(async ({ where }: any) => {
          return rows.find((row) => row.id === where.id && row.userPubkey === where.userPubkey) || null;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const row = rows.find((r) => r.id === where.id);
          if (!row) return null;
          Object.assign(row, data);
          return row;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          let count = 0;
          rows.forEach((row) => {
            if (row.userPubkey === where.userPubkey && row.read === where.read) {
              Object.assign(row, data);
              count += 1;
            }
          });
          return { count };
        }),
      },
    };

    return {
      service: new NotificationsService(prisma as any),
      rows,
    };
  }

  test('creates notifications and returns unread count', async () => {
    const { service } = setup();
    await service.create({ userPubkey: 'pubkey-1', type: 'outbid', title: 't1', body: 'b1' });
    await service.create({ userPubkey: 'pubkey-1', type: 'auction_ending', title: 't2', body: 'b2' });

    const list = await service.list('pubkey-1');
    expect(list.length).toBe(2);

    const unread = await service.unreadCount('pubkey-1');
    expect(unread).toBe(2);
  });

  test('marks one notification read', async () => {
    const { service } = setup();
    const created = await service.create({ userPubkey: 'pubkey-2', type: 'outbid', title: 't1', body: 'b1' });

    const updated = await service.markRead('pubkey-2', created.id);
    expect(updated).toBeTruthy();
    expect(updated?.readAt).toBeTruthy();

    const unread = await service.unreadCount('pubkey-2');
    expect(unread).toBe(0);
  });

  test('marks all unread notifications read', async () => {
    const { service } = setup();
    await service.create({ userPubkey: 'pubkey-3', type: 'outbid', title: 't1', body: 'b1' });
    await service.create({ userPubkey: 'pubkey-3', type: 'auction_ending', title: 't2', body: 'b2' });

    const result = await service.markAllRead('pubkey-3');
    expect(result.marked).toBe(2);

    const unread = await service.unreadCount('pubkey-3');
    expect(unread).toBe(0);
  });
});
