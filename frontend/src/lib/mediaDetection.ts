/**
 * Enhanced media detection utilities
 * Handles images without file extensions, GIF animation, and better MIME detection
 */

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|avif|svg|bmp|ico)(\?.*)?$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg|ogv)(\?.*)?$/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|flac|opus|oga)(\?.*)?$/i;

export interface MediaDetectionResult {
  type: 'image' | 'video' | 'audio' | 'unknown';
  url: string;
  isGif?: boolean;
  mimeType?: string;
}

/**
 * Detect if a URL is likely an image based on extension
 */
export function hasImageExtension(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return IMAGE_EXT.test(pathname);
  } catch {
    return false;
  }
}

/**
 * Detect if a URL is likely a GIF based on extension
 */
export function isGifUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return /\.gif(\?.*)?$/i.test(pathname);
  } catch {
    return false;
  }
}

/**
 * Check if a URL might be an image even without a file extension
 * Common patterns: imgur.com/abc123, i.redd.it/abc123, etc.
 */
export function isLikelyImageUrl(url: string): boolean {
  if (hasImageExtension(url)) return true;

  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.toLowerCase();

    // Known image hosting domains that don't require extensions
    const imageHosts = [
      'i.imgur.com',
      'imgur.com',
      'i.redd.it',
      'preview.redd.it',
      'pbs.twimg.com',
      'media.tenor.com',
      'media.giphy.com',
      'i.postimg.cc',
      'imagedelivery.net', // Cloudflare Images
      'images.unsplash.com',
      'nostr.build',
      'void.cat',
      'nostrimg.com',
      'primal.net/api/media-cache',
    ];

    // Check if host matches known image domains
    if (imageHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return true;
    }

    // Check for /image/ or /img/ in path
    if (path.includes('/image/') || path.includes('/img/') || path.includes('/media/')) {
      return true;
    }

    // Check for Cloudflare image transforms
    if (u.searchParams.has('width') && u.searchParams.has('height')) {
      return true;
    }

  } catch {
    return false;
  }

  return false;
}

/**
 * Detect media type from URL with enhanced heuristics
 */
export function detectMediaType(url: string, mimeType?: string): MediaDetectionResult {
  const normalized = url.trim();

  // Check MIME type if available
  if (mimeType) {
    if (mimeType.startsWith('image/')) {
      return {
        type: 'image',
        url: normalized,
        isGif: mimeType === 'image/gif',
        mimeType,
      };
    }
    if (mimeType.startsWith('video/')) {
      return { type: 'video', url: normalized, mimeType };
    }
    if (mimeType.startsWith('audio/')) {
      return { type: 'audio', url: normalized, mimeType };
    }
  }

  // Check file extensions
  try {
    const pathname = new URL(normalized).pathname;

    if (IMAGE_EXT.test(pathname)) {
      return {
        type: 'image',
        url: normalized,
        isGif: /\.gif(\?.*)?$/i.test(pathname),
      };
    }

    if (VIDEO_EXT.test(pathname)) {
      return { type: 'video', url: normalized };
    }

    if (AUDIO_EXT.test(pathname)) {
      return { type: 'audio', url: normalized };
    }
  } catch {
    return { type: 'unknown', url: normalized };
  }

  // Use heuristics for extension-less URLs
  if (isLikelyImageUrl(normalized)) {
    return {
      type: 'image',
      url: normalized,
      // Can't determine if GIF without extension, but that's okay
    };
  }

  return { type: 'unknown', url: normalized };
}

/**
 * Extract MIME type from imeta tag
 */
export function extractMimeFromImeta(tag: string[]): string | undefined {
  if (tag[0] !== 'imeta') return undefined;

  for (const entry of tag.slice(1)) {
    const match = entry.match(/(?:^|\s)m\s+([^\s]+)/i);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  }

  return undefined;
}
