import { Injectable } from '@nestjs/common';
import { parseProfile, isValidNip05, parseNip05 } from '@strangesignal/nostr-profile';
import { SimplePool, type Event, nip19 } from 'nostr-tools';

@Injectable()
export class PrimitiveProfileService {
  private readonly relays = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.primal.net'];

  private normalizePubkey(pubkey: string): string {
    if (pubkey.startsWith('npub1')) {
      const decoded = nip19.decode(pubkey);
      return decoded.data as string;
    }
    return pubkey;
  }

  async getValidationHints(pubkeyOrNpub: string) {
    const pubkey = this.normalizePubkey(pubkeyOrNpub);
    const pool = new SimplePool();

    try {
      const latest = await pool.get(this.relays, { kinds: [0], authors: [pubkey] }) as Event | null;
      if (!latest) {
        return {
          pubkey,
          hasProfileEvent: false,
          validNip05: false,
          nip05: null,
          hints: ['No kind:0 profile event found on default relays.'],
        };
      }

      const parsed = parseProfile(latest);
      const hints: string[] = [];
      const nip05 = parsed.nip05 || null;
      const validNip05 = Boolean(nip05 && isValidNip05(nip05));

      if (!parsed.name && !parsed.displayName) hints.push('Add name or display_name for better discoverability.');
      if (!parsed.picture) hints.push('Add profile picture for stronger identity trust.');
      if (nip05 && !validNip05) hints.push('NIP-05 format looks invalid. Expected user@domain.tld.');
      if (nip05 && validNip05) {
        const parsedNip05 = parseNip05(nip05);
        hints.push(`NIP-05 domain detected: ${parsedNip05.domain}`);
      }
      if (!nip05) hints.push('Add NIP-05 identifier to improve trust and verification UX.');

      return {
        pubkey,
        hasProfileEvent: true,
        validNip05,
        nip05,
        hasLud16: Boolean(parsed.lud16),
        identityClaimCount: parsed.identityClaims?.length || 0,
        hints,
      };
    } finally {
      pool.close(this.relays);
    }
  }
}
