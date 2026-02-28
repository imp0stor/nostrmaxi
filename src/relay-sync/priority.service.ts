import { Injectable } from '@nestjs/common';

export interface UserPriority {
  pubkey: string;
  score: number;
  lastActive: number;
  followerCount: number;
  zapsSent: number;
  zapsReceived: number;
  syncedAt?: number;
}

@Injectable()
export class PriorityService {
  private static readonly DAY_SECONDS = 86_400;

  scoreUser(user: Omit<UserPriority, 'score'>): number {
    const now = Math.floor(Date.now() / 1000);
    let score = 0;

    if (user.lastActive >= now - 7 * PriorityService.DAY_SECONDS) {
      score += 100;
    }

    if (user.followerCount > 1000) {
      score += 50;
    }

    if (user.zapsReceived > 0) {
      score += 30;
    }

    if (user.lastActive >= now - 30 * PriorityService.DAY_SECONDS) {
      score += 20;
    }

    if (user.lastActive <= now - 90 * PriorityService.DAY_SECONDS) {
      score -= 50;
    }

    if (user.syncedAt && user.syncedAt >= now - PriorityService.DAY_SECONDS) {
      score -= 100;
    }

    return score;
  }

  buildPriority(input: Omit<UserPriority, 'score'>): UserPriority {
    return {
      ...input,
      score: this.scoreUser(input),
    };
  }
}
