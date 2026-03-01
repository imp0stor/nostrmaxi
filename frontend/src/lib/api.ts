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
  NotificationItem,
  Book,
  BookChapter,
} from '../types';
import type { QaQuestionDetail, QaQuestionSummary, QaTag } from '../types/qa';

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

  async getAdminCheck(): Promise<{ isAdmin: boolean }> {
    return this.request('/admin/check');
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

  async getEntitlement(npubOrPubkey: string): Promise<{ pubkey: string; tier: SubscriptionTier; isPaid: boolean; expiresAt: string | null }> {
    return this.request(`/subscription/entitlement/${encodeURIComponent(npubOrPubkey)}`);
  }

  async setEntitlement(npubOrPubkey: string, tier: SubscriptionTier): Promise<{ pubkey: string; tier: SubscriptionTier; isPaid: boolean; expiresAt: string | null }> {
    return this.request(`/subscription/entitlement/${encodeURIComponent(npubOrPubkey)}`, {
      method: 'POST',
      body: JSON.stringify({ tier }),
    });
  }

  async registerOnboardingBootstrap(payload: { authMethod: 'nip07' | 'nsec' | 'lnurl' | 'nostr_connect'; profile?: { displayName?: string; username?: string; picture?: string } }): Promise<any> {
    return this.request('/onboarding/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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

  // Notifications endpoints
  async getNotifications(limit = 50): Promise<NotificationItem[]> {
    return this.request(`/notifications?limit=${limit}`);
  }

  async getUnreadNotificationsCount(): Promise<{ unread: number }> {
    return this.request('/notifications/count');
  }

  async markNotificationRead(notificationId: string): Promise<NotificationItem> {
    return this.request(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST' });
  }

  async markAllNotificationsRead(): Promise<{ marked: number }> {
    return this.request('/notifications/read-all', { method: 'POST' });
  }

  // Primitives endpoints
  async getPrimitiveWotScore(pubkey: string, anchor?: string): Promise<any> {
    const query = anchor ? `?anchor=${encodeURIComponent(anchor)}` : '';
    return this.request(`/primitives/wot/score/${encodeURIComponent(pubkey)}${query}`);
  }

  async getProfileValidationHints(pubkey: string): Promise<any> {
    return this.request(`/primitives/profile/${encodeURIComponent(pubkey)}/validation-hints`);
  }

  async listKb(limit = 20): Promise<{ total: number; items: any[] }> {
    return this.request(`/primitives/kb?limit=${limit}`);
  }

  async searchKb(query: string, limit = 20): Promise<{ total: number; items: any[] }> {
    return this.request(`/primitives/kb/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async getProfileEngagement(pubkey: string, limit = 80): Promise<any> {
    return this.request(`/primitives/engagement/profile/${encodeURIComponent(pubkey)}?limit=${limit}`);
  }

  async getRelaySyncStatus(): Promise<any> {
    return this.request('/relay-sync/status');
  }

  async getRelaySyncDebug(): Promise<any> {
    return this.request('/relay-sync/debug');
  }

  async getEnhancedProfile(pubkeyOrNip05OrNpub: string): Promise<any> {
    return this.request(`/profiles/${encodeURIComponent(pubkeyOrNip05OrNpub)}`);
  }

  async getProfileEndorsements(pubkeyOrNip05OrNpub: string): Promise<any> {
    return this.request(`/profiles/${encodeURIComponent(pubkeyOrNip05OrNpub)}/endorsements`);
  }

  async endorseProfile(pubkey: string, skill: string, note?: string): Promise<any> {
    return this.request(`/profiles/${encodeURIComponent(pubkey)}/endorse`, {
      method: 'POST',
      body: JSON.stringify({ skill, note }),
    });
  }

  async updateProfileTheme(pubkey: string, theme: 'dark' | 'light' | 'purple' | 'orange' | 'custom'): Promise<any> {
    return this.request(`/profiles/${encodeURIComponent(pubkey)}`, {
      method: 'PATCH',
      body: JSON.stringify({ theme }),
    });
  }

  // Feeds endpoints
  async createFeed(payload: { name: string; contentTypes: string[]; tier: 'wot' | 'genuine' | 'firehose'; wotThreshold: number; isPublic: boolean }): Promise<any> {
    return this.request('/feeds', { method: 'POST', body: JSON.stringify(payload) });
  }

  async listFeeds(): Promise<any[]> {
    return this.request('/feeds');
  }

  async updateFeed(feedId: string, payload: Partial<{ name: string; contentTypes: string[]; tier: 'wot' | 'genuine' | 'firehose'; wotThreshold: number; isPublic: boolean }>): Promise<any> {
    return this.request(`/feeds/${encodeURIComponent(feedId)}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  async deleteFeed(feedId: string): Promise<void> {
    return this.request(`/feeds/${encodeURIComponent(feedId)}`, { method: 'DELETE' });
  }

  async getTrendingFeeds(limit = 50): Promise<any[]> {
    return this.request(`/feeds/trending?limit=${limit}`);
  }

  async listFeedSubscriptions(): Promise<any[]> {
    return this.request('/feeds/subscriptions/mine');
  }

  async subscribeFeed(feedId: string): Promise<any> {
    return this.request(`/feeds/${encodeURIComponent(feedId)}/subscribe`, { method: 'POST' });
  }

  async unsubscribeFeed(feedId: string): Promise<void> {
    return this.request(`/feeds/${encodeURIComponent(feedId)}/subscribe`, { method: 'DELETE' });
  }

  // Books endpoints
  async createBook(payload: { title: string; description?: string; coverUrl?: string }): Promise<Book> {
    return this.request('/books', { method: 'POST', body: JSON.stringify(payload) });
  }

  async listBooks(): Promise<Book[]> {
    return this.request('/books');
  }

  async getBook(bookId: string): Promise<Book> {
    return this.request(`/books/${encodeURIComponent(bookId)}`);
  }

  async updateBook(bookId: string, payload: Partial<{ title: string; description: string; coverUrl: string }>): Promise<Book> {
    return this.request(`/books/${encodeURIComponent(bookId)}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  async deleteBook(bookId: string): Promise<void> {
    return this.request(`/books/${encodeURIComponent(bookId)}`, { method: 'DELETE' });
  }

  async createChapter(bookId: string, payload: { title: string; content: string; orderIndex?: number }): Promise<BookChapter> {
    return this.request(`/books/${encodeURIComponent(bookId)}/chapters`, { method: 'POST', body: JSON.stringify(payload) });
  }

  async updateChapter(bookId: string, chapterId: string, payload: Partial<{ title: string; content: string; orderIndex: number }>): Promise<BookChapter> {
    return this.request(`/books/${encodeURIComponent(bookId)}/chapters/${encodeURIComponent(chapterId)}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  async deleteChapter(bookId: string, chapterId: string): Promise<void> {
    return this.request(`/books/${encodeURIComponent(bookId)}/chapters/${encodeURIComponent(chapterId)}`, { method: 'DELETE' });
  }

  async publishBook(bookId: string): Promise<Book> {
    return this.request(`/books/${encodeURIComponent(bookId)}/publish`, { method: 'POST' });
  }

  async exportBook(bookId: string, format: 'pdf' | 'epub'): Promise<{ format: 'pdf' | 'epub'; downloadUrl: string; sizeBytes: number }> {
    return this.request(`/books/${encodeURIComponent(bookId)}/export?format=${format}`);
  }

  async getBookSales(bookId: string): Promise<{ bookId: string; totalEarningsSats: number; buyerCount: number; status: string; updatedAt: string }> {
    return this.request(`/books/${encodeURIComponent(bookId)}/sales`);
  }

  // Gift cards endpoints
  async getGiftCardDesigns(): Promise<Array<{ name: string; title: string; imageUrl: string; category: string; custom: boolean }>> {
    return this.request('/gift-cards/designs');
  }

  async createGiftCard(payload: { amountSats: number; designName?: string; designUrl?: string; message?: string }): Promise<any> {
    return this.request('/gift-cards', { method: 'POST', body: JSON.stringify(payload) });
  }

  async listMyGiftCards(): Promise<any[]> {
    return this.request('/gift-cards/mine');
  }

  async getGiftCardBalance(code: string): Promise<any> {
    return this.request(`/gift-cards/${encodeURIComponent(code)}/balance`);
  }

  async fundGiftCard(code: string, paymentRef: string): Promise<any> {
    return this.request(`/gift-cards/${encodeURIComponent(code)}/fund`, {
      method: 'POST',
      body: JSON.stringify({ paymentRef }),
    });
  }

  async redeemGiftCard(code: string, payload: { invoice?: string; lightningAddress?: string; amountSats?: number; redeemerPubkey?: string }): Promise<any> {
    return this.request(`/gift-cards/${encodeURIComponent(code)}/redeem`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // QA endpoints
  async createQuestion(payload: { title: string; body: string; tags: string[]; bountySats?: number }): Promise<QaQuestionDetail> {
    return this.request('/qa/questions', { method: 'POST', body: JSON.stringify(payload) });
  }

  async listQuestions(tag?: string, sort: 'recent' | 'votes' | 'bounty' = 'recent'): Promise<QaQuestionSummary[]> {
    const params = new URLSearchParams();
    if (tag) params.set('tag', tag);
    params.set('sort', sort);
    return this.request(`/qa/questions?${params.toString()}`);
  }

  async getQuestion(id: string): Promise<QaQuestionDetail> {
    return this.request(`/qa/questions/${encodeURIComponent(id)}`);
  }

  async createAnswer(questionId: string, payload: { body: string }) {
    return this.request(`/qa/questions/${encodeURIComponent(questionId)}/answers`, { method: 'POST', body: JSON.stringify(payload) });
  }

  async voteAnswer(answerId: string, direction: 'up' | 'down') {
    return this.request(`/qa/answers/${encodeURIComponent(answerId)}/vote`, { method: 'POST', body: JSON.stringify({ direction }) });
  }

  async acceptAnswer(questionId: string, answerId: string) {
    return this.request(`/qa/questions/${encodeURIComponent(questionId)}/accept/${encodeURIComponent(answerId)}`, { method: 'POST' });
  }

  async listQaTags(): Promise<QaTag[]> {
    return this.request('/qa/tags');
  }

  async getReputation(pubkey: string): Promise<{ pubkey: string; score: number; canEditOthers: boolean }> {
    return this.request(`/qa/reputation/${encodeURIComponent(pubkey)}`);
  }
}

export const api = new ApiClient();
