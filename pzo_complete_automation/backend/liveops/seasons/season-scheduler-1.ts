import { Injectable } from '@nestjs/common';
import { SchedulerRegistry, IntervalSchedule, CronSchedule } from '@nestjs/schedule';
import { LiveOpsService } from './liveops.service';
import { Season } from './season.entity';

@Injectable()
export class SeasonSchedulerService {
constructor(
private readonly liveOpsService: LiveOpsService,
private readonly schedulerRegistry: SchedulerRegistry,
) {}

scheduleSeasons() {
const dailySchedule = new CronSchedule('0 0 * * *'); // Runs once per day at midnight (UTC)
this.schedulerRegistry.scheduleJob(dailySchedule, async () => {
const seasons = await this.liveOpsService.getAvailableSeasons();
if (seasons.length > 0) {
const newSeason = seasons.pop();
await this.liveOpsService.startSeason(newSeason);
}
});
}
}
