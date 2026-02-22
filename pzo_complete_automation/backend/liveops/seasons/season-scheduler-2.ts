import { Injectable } from '@nestjs/common';
import { Season } from './season.model';
import { ScheduleService } from './schedule.service';

@Injectable()
export class SeasonSchedulerService {
constructor(private readonly scheduleService: ScheduleService) {}

async startSeason(season: Season) {
const upcomingEvents = await this.scheduleService.getUpcomingEvents();
if (upcomingEvents.length > 0) {
throw new Error('Cannot start a season with ongoing events');
}

// You can add your logic to handle starting the season here

await this.saveStartedSeason(season);
}

async saveStartedSeason(season: Season) {
// Save started season in the database or other storage
}
}
