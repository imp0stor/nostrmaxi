import { mkdtemp, rm } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { SettingsService } from '../settings/settings.service';

describe('SettingsService', () => {
  let tempDir: string;
  let cwd: string;

  beforeEach(async () => {
    cwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'nostrmaxi-settings-'));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(cwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates default settings on first load', async () => {
    const service = new SettingsService();
    const settings = await service.getSettings();

    expect(settings.branding.appName).toBe('NostrMaxi');
    expect(settings.profile.saveToastMs).toBe(2200);
  });

  it('updates and persists settings patch', async () => {
    const service = new SettingsService();

    await service.updateSettings({ branding: { tagline: 'Enterprise Nostr Identity' } as any });
    const next = await service.getSettings();

    expect(next.branding.tagline).toBe('Enterprise Nostr Identity');
    expect(next.branding.appName).toBe('NostrMaxi');
  });

  it('returns public settings shape', async () => {
    const service = new SettingsService();
    const publicSettings = await service.getPublicSettings();

    expect(publicSettings).toHaveProperty('branding');
    expect(publicSettings).toHaveProperty('profile');
  });
});
