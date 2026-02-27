const querySyncMock = jest.fn();
const closeMock = jest.fn();

jest.mock('nostr-tools', () => ({
  nip19: {
    decode: jest.fn(() => {
      throw new Error('decode not required');
    }),
  },
  SimplePool: class {
    querySync(...args: any[]) {
      return querySyncMock(...args);
    }
    close(...args: any[]) {
      return closeMock(...args);
    }
  },
}));

describe('resolveQuotedEvents', () => {
  beforeEach(() => {
    querySyncMock.mockReset();
    closeMock.mockReset();
    jest.resetModules();
  });

  it('retries unresolved quoted events and resolves on later attempt', async () => {
    querySyncMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'evt-1', kind: 1, pubkey: 'pk1', created_at: 1, content: 'hi', tags: [] }]);

    const { resolveQuotedEvents } = await import('../src/lib/quotes');
    const out = await resolveQuotedEvents(['evt-1']);

    expect(querySyncMock).toHaveBeenCalledTimes(2);
    expect(out.get('evt-1')?.content).toBe('hi');
  });

  it('uses in-memory cache for subsequent resolution calls', async () => {
    querySyncMock.mockResolvedValue([{ id: 'evt-2', kind: 1, pubkey: 'pk2', created_at: 2, content: 'cached', tags: [] }]);

    const { resolveQuotedEvents } = await import('../src/lib/quotes');
    const first = await resolveQuotedEvents(['evt-2']);
    const second = await resolveQuotedEvents(['evt-2']);

    expect(first.get('evt-2')?.content).toBe('cached');
    expect(second.get('evt-2')?.content).toBe('cached');
    expect(querySyncMock).toHaveBeenCalledTimes(1);
  });
});
