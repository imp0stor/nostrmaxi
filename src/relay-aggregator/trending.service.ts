import { Injectable } from '@nestjs/common';

@Injectable()
export class TrendingService {
  private readonly scores = new Map<string, number>();

  getScore(eventId: string): number {
    return this.scores.get(eventId) || 0;
  }

  bump(eventId: string, amount = 1): void {
    this.scores.set(eventId, this.getScore(eventId) + amount);
  }
}
