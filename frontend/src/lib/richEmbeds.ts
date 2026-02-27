export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  audio?: string;
  siteName?: string;
  domain: string;
}

export interface GitHubRepoRef {
  owner: string;
  repo: string;
}

export function extractGitHubRepo(url: string): GitHubRepoRef | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'github.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    if (parts[0].toLowerCase() === 'orgs' || parts[0].toLowerCase() === 'users') return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

export function extractTweetId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'x.com' && host !== 'twitter.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const statusIdx = parts.findIndex((p) => p.toLowerCase() === 'status');
    if (statusIdx === -1 || !parts[statusIdx + 1]) return null;
    return parts[statusIdx + 1];
  } catch {
    return null;
  }
}

export function toFxTwitterUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'x.com' && host !== 'twitter.com') return null;
    const next = new URL(u.toString());
    next.hostname = 'fxtwitter.com';
    return next.toString();
  } catch {
    return null;
  }
}
