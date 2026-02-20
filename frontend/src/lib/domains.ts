const primaryDomain = 'nostrmaxi.com';

const strangeSignalDomains = ['strangesignal.studio', 'fragstr.network'];

export const NIP05_PRIMARY_DOMAIN = primaryDomain;

export const NIP05_PARTNER_DOMAINS = Array.from(
  new Set([
    primaryDomain,
    ...strangeSignalDomains.filter((domain) => domain !== primaryDomain),
  ])
);

export const BYOD_OPTION = {
  label: 'Bring your own domain (advanced, in progress)',
  value: '__BYOD__',
};
