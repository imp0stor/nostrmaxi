/**
 * Relay Configuration
 * 
 * Global configuration for local relay usage.
 * Call setupLocalRelay() on app init to enable local relay caching.
 */

export interface RelayConfig {
  localRelayUrl: string;
  enabled: boolean;
}

const DEFAULT_LOCAL_RELAY_URL = 'ws://localhost:7777';

/**
 * Enable local relay caching
 * 
 * Call this on app init after checking if local relay is available.
 */
export function setupLocalRelay(config?: Partial<RelayConfig>): void {
  if (typeof window === 'undefined') return;

  const cfg: RelayConfig = {
    localRelayUrl: config?.localRelayUrl || DEFAULT_LOCAL_RELAY_URL,
    enabled: config?.enabled ?? false,
  };

  (window as any).__NOSTRMAXI_LOCAL_RELAY_URL__ = cfg.localRelayUrl;
  (window as any).__NOSTRMAXI_LOCAL_RELAY_ENABLED__ = cfg.enabled;

  console.log(
    `[RelayConfig] Local relay ${cfg.enabled ? 'enabled' : 'disabled'}: ${cfg.localRelayUrl}`
  );
}

/**
 * Check if local relay is available
 * 
 * Attempts to connect to local relay and returns true if successful.
 */
export async function checkLocalRelayAvailable(
  url: string = DEFAULT_LOCAL_RELAY_URL
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 2000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}

/**
 * Auto-detect and setup local relay
 * 
 * Checks if local relay is available and enables it automatically.
 * Call this on app init.
 */
export async function autoSetupLocalRelay(): Promise<boolean> {
  const available = await checkLocalRelayAvailable();
  setupLocalRelay({ enabled: available });
  return available;
}

/**
 * Get current relay config
 */
export function getRelayConfig(): RelayConfig {
  if (typeof window === 'undefined') {
    return { localRelayUrl: DEFAULT_LOCAL_RELAY_URL, enabled: false };
  }

  return {
    localRelayUrl: (window as any).__NOSTRMAXI_LOCAL_RELAY_URL__ || DEFAULT_LOCAL_RELAY_URL,
    enabled: (window as any).__NOSTRMAXI_LOCAL_RELAY_ENABLED__ === true,
  };
}
