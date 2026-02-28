import { Injectable } from '@nestjs/common';
import { CURATED_FEEDS } from '../config/curated-feeds';
import { ONBOARDING_FOLLOW_CATEGORIES } from '../config/onboarding-categories';
import { RELAY_SUGGESTIONS } from '../config/relay-suggestions';

interface CompleteOnboardingPayload {
  identity: {
    pubkey: string;
    name?: string;
    nip05?: string;
    lightningAddress?: string;
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

  complete(payload: CompleteOnboardingPayload) {
    const selectedFeeds = CURATED_FEEDS.filter((feed) => payload.feeds.selected.includes(feed.id));

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

    return {
      success: true,
      message: 'Onboarding complete. Feed subscriptions prepared with NIP-51 list.',
      summary: {
        identity: payload.identity,
        relayCount: payload.relays.selected.length,
        followCount: payload.follows.selected.length,
        categoryCount: payload.follows.categories.length,
        feedCount: payload.feeds.selected.length,
      },
      feedListEvent,
    };
  }
}
