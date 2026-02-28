import type {
  AuthChallenge,
  AuthResponse,
  LnurlAuth,
  User,
  TierInfo,
  Subscription,
  PaymentInvoice,
  PaymentStatus,
  PaymentSummary,
  Receipt,
  ApiKey,
  ApiKeyUsage,
  SubscriptionTier,
} from '../types';

// Use env var for API URL, fallback to same-origin relative path
// Always use relative path - Caddy proxies /api/* to backend
const API_BASE = (typeof process !== 'undefined' && (process as any).env?.VITE_API_URL) || '/api/v1';

class ApiClient {
  private token: string | null = null;

  private isJsonResponse(contentType: string | null): boolean {
    if (!contentType) return false;
    const normalized = contentType.toLowerCase();
    return normalized.includes('application/json') || normalized.includes('+json');
  }

  private async safeReadBody(response: Response): Promise<{ json?: unknown; text?: string }> {
    const contentType = response.headers.get('content-type');

    if (this.isJsonResponse(contentType)) {
      try {
        return { json: await response.json() };
      } catch {
        // Fall through to safe text extraction for malformed JSON responses.
      }
    }

    const text = await response.text().catch(() => '');

    if (!text) {
      return { text: '' };
    }

    try {
      return { json: JSON.parse(text), text };
    } catch {
      return { text };
    }
  }

  private formatHttpError(response: Response, payload: { json?: unknown; text?: string }): string {
    const status = `HTTP ${response.status}`;

    if (payload.json && typeof payload.json === 'object') {
      const maybeMessage = (payload.json as { message?: unknown }).message;
      if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
        return maybeMessage;
      }
    }

    if (payload.text) {
      const trimmed = payload.text.trim();
      if (trimmed.startsWith('<')) {
        return `${status}: Server returned HTML instead of JSON`;
      }
      return `${status}: ${trimmed.slice(0, 180)}`;
    }

    return status;
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('nostrmaxi_token', token);
    } else {
      localStorage.removeItem('nostrmaxi_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('nostrmaxi_token');
    }
    return this.token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = await this.safeReadBody(response);

    if (!response.ok) {
      throw new Error(this.formatHttpError(response, payload));
    }

    if (payload.json !== undefined) {
      return payload.json as T;
    }

    return undefined as T;
  }

  // Auth endpoints
  async getChallenge(pubkey?: string): Promise<AuthChallenge> {
    return this.request('/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ pubkey }),
    });
  }

  async verifyChallenge(event: any): Promise<AuthResponse> {
    return this.request('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ event }),
    });
  }

  async getLnurlAuth(): Promise<LnurlAuth> {
    return this.request('/auth/lnurl');
  }

  async pollLnurlAuth(k1: string): Promise<{ status: string; token?: string; user?: User; expiresAt?: number }> {
    return this.request(`/auth/lnurl-poll?k1=${encodeURIComponent(k1)}`);
  }

  async getMe(): Promise<User> {
    return this.request('/auth/me');
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
    this.setToken(null);
  }

  async getSessions(): Promise<Array<{
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: string;
    lastUsedAt: string;
  }>> {
    return this.request('/auth/sessions');
  }

  async revokeSession(sessionId: string): Promise<void> {
    return this.request(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
  }

  // Payment endpoints
  async getTiers(): Promise<TierInfo[]> {
    return this.request('/payments/tiers');
  }

  async createInvoice(
    tier: SubscriptionTier,
    applyWotDiscount = true,
    billingCycle: 'monthly' | 'annual' | 'lifetime' = 'monthly'
  ): Promise<PaymentInvoice> {
    return this.request('/payments/invoice', {
      method: 'POST',
      body: JSON.stringify({ tier, applyWotDiscount, billingCycle }),
    });
  }

  async checkInvoice(paymentId: string): Promise<PaymentStatus> {
    return this.request(`/payments/invoice/${paymentId}`);
  }

  async getPaymentHistory(limit = 20): Promise<PaymentSummary[]> {
    return this.request(`/payments/history?limit=${limit}`);
  }

  async getReceipt(paymentId: string): Promise<Receipt> {
    return this.request(`/payments/receipt/${paymentId}`);
  }

  // Subscription endpoints
  async getSubscription(): Promise<Subscription> {
    return this.request('/subscription');
  }

  async upgradeSubscription(tier: SubscriptionTier, applyWotDiscount = true): Promise<PaymentInvoice> {
    return this.request('/subscription/upgrade', {
      method: 'POST',
      body: JSON.stringify({ tier, applyWotDiscount }),
    });
  }

  async downgradeSubscription(): Promise<{ scheduled: boolean; message: string }> {
    return this.request('/subscription/downgrade', { method: 'POST' });
  }

  async cancelSubscription(): Promise<{ cancelled: boolean; message: string }> {
    return this.request('/subscription/cancel', { method: 'POST' });
  }

  async reactivateSubscription(): Promise<{ reactivated: boolean }> {
    return this.request('/subscription/reactivate', { method: 'POST' });
  }

  // API Keys endpoints
  async createApiKey(name: string, permissions?: string[]): Promise<ApiKey> {
    return this.request('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name, permissions }),
    });
  }

  async listApiKeys(): Promise<ApiKey[]> {
    return this.request('/api-keys');
  }

  async getApiKeyUsage(keyId: string): Promise<ApiKeyUsage> {
    return this.request(`/api-keys/${keyId}/usage`);
  }

  async revokeApiKey(keyId: string): Promise<void> {
    return this.request(`/api-keys/${keyId}`, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
