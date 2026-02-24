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

const API_BASE = '/api/v1';

class ApiClient {
  private token: string | null = null;

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

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
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
