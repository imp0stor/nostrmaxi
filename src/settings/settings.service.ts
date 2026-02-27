import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface AppSettings {
  branding: {
    appName: string;
    tagline: string;
    footerText: string;
    githubUrl: string;
    nostrUrl: string;
  };
  profile: {
    qrProviderBaseUrl: string;
    saveToastMs: number;
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  branding: {
    appName: 'NostrMaxi',
    tagline: 'Built with ⚡ for the Nostr community',
    footerText: 'Built with ⚡ for the Nostr community',
    githubUrl: 'https://github.com/nostrmaxi',
    nostrUrl: 'https://njump.me/npub1nostrmaxi',
  },
  profile: {
    qrProviderBaseUrl: 'https://api.qrserver.com/v1/create-qr-code/',
    saveToastMs: 2200,
  },
};

@Injectable()
export class SettingsService {
  private readonly settingsPath = path.join(process.cwd(), 'data', 'app-settings.json');

  private mergeSettings(partial?: Partial<AppSettings>): AppSettings {
    return {
      branding: { ...DEFAULT_SETTINGS.branding, ...(partial?.branding || {}) },
      profile: { ...DEFAULT_SETTINGS.profile, ...(partial?.profile || {}) },
    };
  }

  private async ensureFile(): Promise<void> {
    const dir = path.dirname(this.settingsPath);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(this.settingsPath);
    } catch {
      await fs.writeFile(this.settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    }
  }

  async getSettings(): Promise<AppSettings> {
    await this.ensureFile();
    try {
      const raw = await fs.readFile(this.settingsPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return this.mergeSettings(parsed);
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const next = this.mergeSettings({
      branding: { ...current.branding, ...(patch.branding || {}) },
      profile: { ...current.profile, ...(patch.profile || {}) },
    });

    await this.ensureFile();
    await fs.writeFile(this.settingsPath, JSON.stringify(next, null, 2));
    return next;
  }

  async getPublicSettings(): Promise<Pick<AppSettings, 'branding' | 'profile'>> {
    const settings = await this.getSettings();
    return {
      branding: settings.branding,
      profile: settings.profile,
    };
  }
}
