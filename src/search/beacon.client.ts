import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BeaconClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly apiKeyHeader: string;
  private readonly timeoutMs: number;

  constructor(private configService: ConfigService) {
    const baseUrl = this.configService.get<string>('BEACON_API_BASE_URL') || 'http://10.1.10.143:8090';
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = this.configService.get<string>('BEACON_API_KEY');
    this.apiKeyHeader = this.configService.get<string>('BEACON_API_KEY_HEADER') || 'Authorization';
    this.timeoutMs = parseInt(this.configService.get<string>('BEACON_API_TIMEOUT_MS') || '7000', 10);
  }

  async search(params: Record<string, unknown>) {
    return this.request('GET', '/api/search', { query: params });
  }

  async searchFiltered(body: Record<string, unknown>) {
    return this.request('POST', '/api/search/filtered', { body });
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    options: { query?: Record<string, unknown>; body?: Record<string, unknown> },
  ) {
    const url = new URL(`${this.baseUrl}${path}`);
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          return;
        }
        if (Array.isArray(value)) {
          value.forEach((entry) => url.searchParams.append(key, String(entry)));
        } else {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      if (this.apiKeyHeader.toLowerCase() === 'authorization') {
        headers['Authorization'] = this.apiKey.startsWith('Bearer ')
          ? this.apiKey
          : `Bearer ${this.apiKey}`;
      } else {
        headers[this.apiKeyHeader] = this.apiKey;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Beacon responded with ${response.status}: ${text}`);
      }

      if (!text) {
        return null;
      }

      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
