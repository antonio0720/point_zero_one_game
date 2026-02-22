import { Injectable } from '@nestjs/common';
import { ContestantProgressionDTO, ProgressionEventDTO } from '../dto';
import { ContestantService } from '../../contestant';
import { ProgressionRepository } from './progression.repository';

@Injectable()
export class Progression4Service {
constructor(
private readonly contestantService: ContestantService,
private readonly progressionRepo: ProgressionRepository,
) {}

async evaluateProgress(contestantId: number): Promise<ContestantProgressionDTO> {
const contestant = await this.contestantService.findOne(contestantId);

if (!contestant) throw new Error('Contestant not found');

// Assuming you have some event data source (e.g., database, event service, etc.)
const eventsData: ProgressionEventDTO[] = await getEventsData(contestantId);

const progressEvents: ProgressionEventDTO[] = filterProgressEventsForContestant(eventsData, contestantId);
const progress = evaluateProgressBasedOnEvents(progressEvents);

return {
id: contestant.id,
name: contestant.name,
progress,
};
}
}

function filterProgressEventsForContestant(eventsData: ProgressionEventDTO[], contestantId: number): ProgressionEventDTO[] {
return eventsData.filter((event) => event.contestantId === contestantId);
}

function evaluateProgressBasedOnEvents(progressEvents: ProgressionEventDTO[]): number {
// Implement the logic to calculate progress based on the provided progress events.
// For example, sum up all points from the events and return it as the progress level.

let totalPoints = 0;
for (const event of progressEvents) {
totalPoints += event.points;
}

return totalPoints;
}
