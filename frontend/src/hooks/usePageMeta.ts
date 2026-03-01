import { useEffect } from 'react';

interface PageMetaOptions {
  title: string;
  description: string;
  path?: string;
}

const SITE_NAME = 'NostrMaxi';
const DEFAULT_OG_IMAGE = '/og-cover.png';

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    Object.entries(attributes).forEach(([key, value]) => {
      if (key !== 'content') {
        element?.setAttribute(key, value);
      }
    });
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
}

export function usePageMeta({ title, description, path = '/' }: PageMetaOptions) {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const canonicalUrl = `${window.location.origin}${path}`;

    document.title = fullTitle;

    upsertMeta('meta[name="description"]', {
      name: 'description',
      content: description,
    });

    upsertMeta('meta[property="og:title"]', {
      property: 'og:title',
      content: fullTitle,
    });

    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: description,
    });

    upsertMeta('meta[property="og:type"]', {
      property: 'og:type',
      content: 'website',
    });

    upsertMeta('meta[property="og:url"]', {
      property: 'og:url',
      content: canonicalUrl,
    });

    upsertMeta('meta[property="og:image"]', {
      property: 'og:image',
      content: `${window.location.origin}${DEFAULT_OG_IMAGE}`,
    });

    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: 'summary_large_image',
    });

    upsertMeta('meta[name="twitter:title"]', {
      name: 'twitter:title',
      content: fullTitle,
    });

    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: description,
    });

    upsertMeta('meta[name="twitter:image"]', {
      name: 'twitter:image',
      content: `${window.location.origin}${DEFAULT_OG_IMAGE}`,
    });

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }, [description, path, title]);
}
