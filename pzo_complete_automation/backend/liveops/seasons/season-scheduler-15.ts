import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class SeasonSchedulerService {
constructor(
@InjectRepository(Season)
private readonly seasonRepository: Repository<Season>,
) {}

async scheduleNextSeason(): Promise<void> {
const currentSeason = await this.seasonRepository.findOne({ isActive: true });

if (!currentSeason) {
// If there's no active season, start the first one
const firstSeason = await this.seasonRepository.findOne({ orderBy: { startDate: 'ASC' } });
await this.activateSeason(firstSeason);
} else {
// Move to the next season when the current one ends
const endDate = new Date(currentSeason.endDate).getTime();
if (new Date().getTime() > endDate) {
await this.deactivateCurrentSeason(currentSeason);
const nextSeason = await this.seasonRepository.findOne({ orderBy: { startDate: 'ASC' }, where: { startDate: greaterThan(currentSeason.endDate) } });
await this.activateSeason(nextSeason);
}
}
}

private async activateSeason(season: Season): Promise<void> {
season.isActive = true;
await this.seasonRepository.save(season);
}

private async deactivateCurrentSeason(season: Season): Promise<void> {
season.isActive = false;
await this.seasonRepository.save(season);
}
}
