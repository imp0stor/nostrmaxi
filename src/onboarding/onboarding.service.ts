import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CURATED_FEEDS } from '../config/curated-feeds';
import { ONBOARDING_FOLLOW_CATEGORIES } from '../config/onboarding-categories';
import { RELAY_SUGGESTIONS } from '../config/relay-suggestions';

interface RegistrationPayload {
  authMethod: 'nip07' | 'nsec' | 'lnurl' | 'nostr_connect';
  profile?: {
    displayName?: string;
    username?: string;
    picture?: string;
  };
}

interface CompleteOnboardingPayload {
  identity: {
    pubkey: string;
    name?: string;
    nip05?: string;
    lightningAddress?: string;
  };
  profile?: {
    displayName?: string;
    username?: string;
    bio?: string;
    picture?: string;
    banner?: string;
    website?: string;
    lightningAddress?: string;
    nip05?: string;
    nip05Verified?: boolean;
    externalIdentities?: Array<{ platform: string; identity: string; proof: string }>;
    interests?: string[];
    customInterests?: string[];
    skippedFields?: Record<string, boolean>;
  };
  relays: {
    selected: string[];
  };
  follows: {
    selected: string[];
    categories: string[];
  };
  feeds: {
    selected: string[];
  };
}

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  getRelaySuggestions() {
    return {
      suggestions: RELAY_SUGGESTIONS,
      preselected: RELAY_SUGGESTIONS.filter((relay) => relay.recommended).map((relay) => relay.url),
    };
  }

  getFollowCategories() {
    return {
      categories: ONBOARDING_FOLLOW_CATEGORIES,
    };
  }

  getFeeds() {
    return {
      feeds: CURATED_FEEDS,
    };
  }

  async register(pubkey: string, payload: RegistrationPayload) {
    const user = await this.prisma.user.findUnique({ where: { pubkey } });

    if (!user) {
      throw new Error('User not found');
    }

    await this.prisma.auditLog.create({
      data: {
        action: 'onboarding.registered',
        entity: 'User',
        entityId: user.id,
        actorPubkey: pubkey,
        details: {
          authMethod: payload.authMethod,
          profile: payload.profile || {},
          registeredAt: new Date().toISOString(),
        },
      },
    });

    return {
      success: true,
      user: {
        pubkey: user.pubkey,
        npub: user.npub,
      },
      bootstrapState: {
        registered: true,
        authMethod: payload.authMethod,
      },
    };
  }

  async complete(payload: CompleteOnboardingPayload) {
    const selectedFeeds = CURATED_FEEDS.filter((feed) => payload.feeds.selected.includes(feed.id));

    const externalIdentityTags = (payload.profile?.externalIdentities || []).map((item) => [
      'i',
      `${item.platform}:${item.identity}`,
      item.proof,
    ] as string[]);

    const profileEvent = {
      kind: 0,
      content: JSON.stringify({
        name: payload.profile?.username || payload.identity.name || '',
        display_name: payload.profile?.displayName || payload.identity.name || '',
        about: payload.profile?.bio || '',
        picture: payload.profile?.picture || '',
        banner: payload.profile?.banner || '',
        website: payload.profile?.website || '',
        lud16: payload.profile?.lightningAddress || payload.identity.lightningAddress || '',
        nip05: payload.profile?.nip05 || payload.identity.nip05 || '',
      }),
      tags: externalIdentityTags,
    };

    const feedListEvent = {
      kind: 30001,
      tags: [
        ['d', 'nostrmaxi-feeds'],
        ...selectedFeeds.map((feed) => ['feed', feed.id, ...payload.relays.selected] as string[]),
      ],
      content: JSON.stringify({
        feedConfigs: selectedFeeds.map((feed) => ({ id: feed.id, config: feed.config })),
      }),
    };

    const interestTags = payload.profile?.interests || [];

    const interestListEvent = {
      kind: 30001,
      tags: [
        ['d', 'nostrmaxi-interests'],
        ...interestTags.map((tag) => ['t', tag] as string[]),
        ...interestTags.map((topic) => ['topic', topic] as string[]),
      ],
      content: JSON.stringify({ version: 1, customTags: payload.profile?.customInterests || [] }),
    };

    const hashtagFollowEvent = {
      kind: 30001,
      tags: [
        ['d', 'hashtags'],
        ...interestTags.map((tag) => ['t', tag] as string[]),
      ],
      content: '',
    };

    const completionPayload = {
      success: true,
      message: 'Onboarding complete. Profile, follows, relays, and feed subscriptions prepared.',
      summary: {
        identity: payload.identity,
        profile: {
          displayName: payload.profile?.displayName,
          username: payload.profile?.username,
          website: payload.profile?.website,
          nip05Verified: payload.profile?.nip05Verified,
          externalIdentityCount: payload.profile?.externalIdentities?.length || 0,
          interestCount: payload.profile?.interests?.length || 0,
          skippedFields: payload.profile?.skippedFields || {},
        },
        relayCount: payload.relays.selected.length,
        followCount: payload.follows.selected.length,
        categoryCount: payload.follows.categories.length,
        feedCount: payload.feeds.selected.length,
      },
      profileEvent,
      feedListEvent,
      interestListEvent,
      hashtagFollowEvent,
      downstreamUsage: {
        feedFiltering: 'Use hashtags from hashtagFollowEvent tags',
        followSuggestions: 'Prioritize creators posting about selected interests',
        discover: 'Boost content matching selected interest tags',
        aiBio: 'Use linked accounts + interests + selected categories in prompt context',
      },
    };

    const user = await this.prisma.user.findUnique({ where: { pubkey: payload.identity.pubkey } });
    if (user) {
      await this.prisma.auditLog.create({
        data: {
          action: 'onboarding.completed',
          entity: 'User',
          entityId: user.id,
          actorPubkey: payload.identity.pubkey,
          details: completionPayload.summary as any,
        },
      });
    }

    return completionPayload;
  }
}
