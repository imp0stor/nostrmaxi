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

  // Analytics endpoints
  async getAnalytics(endpoint: string): Promise<any> {
    return this.request(`/analytics${endpoint}`);
  }

  async getDashboardAnalytics(): Promise<any> {
    return this.request('/analytics/dashboard');
  }

  async getIdentityHealth(): Promise<any> {
    return this.request('/analytics/identity-health');
  }

  async getGrowthMetrics(period?: string): Promise<any> {
    const query = period ? `?period=${period}` : '';
    return this.request(`/analytics/growth${query}`);
  }

  async getRevenueMetrics(): Promise<any> {
    return this.request('/analytics/revenue');
  }

  // Feed endpoints
  async getFeed(params?: {
    contentTypes?: string[];
    filter?: 'wot' | 'genuine' | 'firehose';
    wotDepth?: number;
    sortBy?: 'newest' | 'oldest' | 'popular' | 'trending';
    limit?: number;
    offset?: number;
  }): Promise<{ items: any[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.contentTypes?.length) {
      searchParams.set('content_types', params.contentTypes.join(','));
    }
    if (params?.filter) {
      searchParams.set('filter', params.filter);
    }
    if (params?.wotDepth) {
      searchParams.set('wot_depth', String(params.wotDepth));
    }
    if (params?.sortBy) {
      searchParams.set('sort', params.sortBy);
    }
    if (params?.limit) {
      searchParams.set('limit', String(params.limit));
    }
    if (params?.offset) {
      searchParams.set('offset', String(params.offset));
    }
    const query = searchParams.toString();
    return this.request(`/feed${query ? '?' + query : ''}`);
  }

  async saveFeedConfig(config: any): Promise<{ success: boolean }> {
    return this.request('/feed/saved', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async getSavedFeeds(): Promise<any[]> {
    return this.request('/feed/saved');
  }

  // Content endpoints
  async listShows(limit = 20, offset = 0): Promise<{ shows: any[]; total: number }> {
    return this.request(`/content/shows?limit=${limit}&offset=${offset}`);
  }

  async getShow(id: string): Promise<any> {
    return this.request(`/content/shows/${id}`);
  }

  async getShowEpisodes(
    id: string,
    limit = 20,
    offset = 0
  ): Promise<{ episodes: any[]; total: number }> {
    return this.request(`/content/shows/${id}/episodes?limit=${limit}&offset=${offset}`);
  }

  async listEpisodes(limit = 20, offset = 0): Promise<{ episodes: any[]; total: number }> {
    return this.request(`/content/episodes?limit=${limit}&offset=${offset}`);
  }

  async getEpisode(id: string): Promise<any> {
    return this.request(`/content/episodes/${id}`);
  }

  async searchContent(query: string, limit = 20): Promise<any[]> {
    return this.request(`/content/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  // WoT (Web of Trust) endpoints
  async getWotScore(pubkey: string): Promise<any> {
    return this.request(`/wot/score/${pubkey}`);
  }

  async verifyWot(pubkey: string, minScore?: number): Promise<any> {
    const query = minScore ? `?minScore=${minScore}` : '';
    return this.request(`/wot/verify/${pubkey}${query}`);
  }

  async getWotNetwork(pubkey: string, depth?: number): Promise<any> {
    const query = depth ? `?depth=${depth}` : '';
    return this.request(`/wot/network/${pubkey}${query}`);
  }

  async recalculateWot(pubkey: string, useRealRelays = false): Promise<any> {
    return this.request(`/wot/recalculate/${pubkey}?useRealRelays=${useRealRelays}`, {
      method: 'POST',
    });
  }

  // Health endpoints
  async getHealth(): Promise<any> {
    return this.request('/health');
  }

  async getServiceStatus(): Promise<any> {
    return this.request('/status');
  }
}

export const api = new ApiClient();
