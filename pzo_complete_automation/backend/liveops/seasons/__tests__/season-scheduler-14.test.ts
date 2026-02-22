import { Test, TestingModule } from '@nestjs/testing';
import { SeasonSchedulerService } from './season-scheduler.service';
import { SeasonEntity } from '../../entities/season.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiveOpsSeason } from '../../entities/liveops-season.entity';
import { ScheduleEvent } from '../../interfaces/schedule-event.interface';

describe('SeasonSchedulerService', () => {
let service: SeasonSchedulerService;
let seasonRepository: Repository<SeasonEntity>;
let liveOpsSeasonRepository: Repository<LiveOpsSeason>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [SeasonSchedulerService, { provide: getRepositoryToken(SeasonEntity), useValue: seasonRepository }, { provide: getRepositoryToken(LiveOpsSeason), useValue: liveOpsSeasonRepository }],
}).compile();

service = module.get<SeasonSchedulerService>(SeasonSchedulerService);
seasonRepository = module.get<Repository<SeasonEntity>>(getRepositoryToken(SeasonEntity));
liveOpsSeasonRepository = module.get<Repository<LiveOpsSeason>>(getRepositoryToken(LiveOpsSeason));
});

describe('scheduleSeasons', () => {
const testScheduleEvents: ScheduleEvent[] = [];

beforeEach(() => {
// Setup test data and schedule events here.
});

it('should schedule seasons correctly', async () => {
// Implement your test case for the 'scheduleSeasons' method.
});
});
});
