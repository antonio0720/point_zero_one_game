/**
 * Countdown Clock Service for Season 0
 */

import { TimeService } from './time_service';
import { CacheService } from '../cache/cache_service';

export class CountdownClockService {
  private readonly timeService: TimeService;
  private readonly cacheService: CacheService;

  constructor() {
    this.timeService = new TimeService();
    this.cacheService = new CacheService();
  }

  public async getCountdown(): Promise<{ remainingSeconds: number, ended: boolean }> {
    const cachedData = await this.cacheService.get('countdown');
    if (cachedData) {
      return cachedData;
    }

    const currentTime = this.timeService.getCurrentTime();
    const endTime = new Date(2026, 12 - 1, 31, 23, 59, 59); // Replace '2026' with the actual year for the specific season

    const remainingSeconds = Math.floor((endTime.getTime() - currentTime.getTime()) / 1000);
    const ended = remainingSeconds <= 0;

    this.cacheService.set('countdown', { remainingSeconds, ended });

    return { remainingSeconds, ended };
  }
}
