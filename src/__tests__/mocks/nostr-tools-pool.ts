export function useWebSocketImplementation(_ws: unknown): void {
  // no-op in tests
}

export class SimplePool {
  querySync(): Promise<any[]> {
    return Promise.resolve([]);
  }

  subscribeMany(_relays: string[], _filters: unknown[], _handlers: unknown): { close: () => void } {
    return { close: () => {} };
  }

  close(_relays?: string[]): void {
    // no-op
  }
}
