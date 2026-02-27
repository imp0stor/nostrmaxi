export interface AppConfig {
  appName: string;
  footerText: string;
  githubUrl: string;
  nostrUrl: string;
  qrProviderBaseUrl: string;
  profileSaveToastMs: number;
}

const withSlash = (input: string) => (input.endsWith('/') ? input : `${input}/`);

export const appConfig: AppConfig = {
  appName: import.meta.env.VITE_APP_NAME || 'NostrMaxi',
  footerText: import.meta.env.VITE_FOOTER_TEXT || 'Built with ⚡ for the Nostr community',
  githubUrl: import.meta.env.VITE_GITHUB_URL || 'https://github.com/nostrmaxi',
  nostrUrl: import.meta.env.VITE_NOSTR_URL || 'https://njump.me/npub1nostrmaxi',
  qrProviderBaseUrl: withSlash(import.meta.env.VITE_QR_PROVIDER_BASE_URL || 'https://api.qrserver.com/v1/create-qr-code/'),
  profileSaveToastMs: Number(import.meta.env.VITE_PROFILE_SAVE_TOAST_MS || 2200),
};
