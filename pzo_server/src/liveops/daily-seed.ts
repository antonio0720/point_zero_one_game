// daily-seed.ts
import { CronJob } from 'cron';
import { v4 as uuidv4 } from 'uuid';
import { mlEnabled } from '../config/ml-config';
import { auditHash, boundedRandom } from '../utils/math-utils';

export class DailySeed {
  private cron: CronJob;

  constructor() {
    this.cron = new CronJob('0 0 * * *', async () => {
      if (mlEnabled) {
        const seed = await this.generateSeed();
        console.log(`New daily seed: ${seed}`);
      }
    });
  }

  public start(): void {
    this.cron.start();
  }

  private async generateSeed(): Promise<string> {
    const hash = auditHash(uuidv4());
    const boundedRandomValue = boundedRandom(0, 1);
    return `${hash}-${boundedRandomValue}`;
  }
}

export { DailySeed };
