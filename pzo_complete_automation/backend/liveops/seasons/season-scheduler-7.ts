import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SeasonRepository } from './season.repository';
import { SeasonDto } from './dto/season.dto';

@Injectable()
export class SeasonSchedulerService {
constructor(private readonly seasonRepository: SeasonRepository) {}

@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async scheduleSeasonsDaily() {
const seasons = await this.seasonRepository.findUpcoming();

for (const season of seasons) {
if (season.startDate <= new Date()) {
await this.seasonRepository.start(season.id);
}
}
}
}
