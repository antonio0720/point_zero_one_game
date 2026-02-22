import { Injectable } from '@nestjs/common';
import { Schedule, Cron, SchedulerRegistry } from '@nestjs/schedule';
import { SeasonRepository } from './season.repository';

@Injectable()
export class SeasonSchedulerService {
constructor(
private readonly seasonRepository: SeasonRepository,
private schedulerRegistry: SchedulerRegistry,
) {}

@Cron('0 0 * 1 *') // Runs every week on Monday at midnight
async startNewSeason() {
const currentSeason = await this.seasonRepository.getCurrentSeason();

if (!currentSeason) {
const newSeason = await this.seasonRepository.createNewSeason();
console.log(`New season "${newSeason.name}" started.`);
} else {
console.log('No new season to start as current one still ongoing.');
}
}
}
