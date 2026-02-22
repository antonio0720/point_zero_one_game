import { Test, TestingModule } from '@nestjs/testing';
import { QuestSchedulingService } from './quest-scheduling.service';
import { QuestSchedulingController } from './quest-scheduling.controller';
import { Quest } from '../entities/quest.entity';
import { Achievement } from '../entities/achievement.entity';
import { BattlePass } from '../entities/battle-pass.entity';
import { getConnection, Repository } from 'typeorm';
import { of } from 'rxjs';

describe('QuestSchedulingService', () => {
let service: QuestSchedulingService;
let questRepository: Repository<Quest>;
let achievementRepository: Repository<Achievement>;
let battlePassRepository: Repository<BattlePass>;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [QuestSchedulingController],
providers: [QuestSchedulingService],
})
.overrideProvider(getConnection)
.useValue(createMockConnection())
.compile();

service = module.get<QuestSchedulingService>(QuestSchedulingService);
questRepository = module.get<Repository<Quest>>(getConnection().getRepository(Quest));
achievementRepository = module.get<Repository<Achievement>>(getConnection().getRepository(Achievement));
battlePassRepository = module.get<Repository<BattlePass>>(getConnection().getRepository(BattlePass));
});

describe('scheduleQuests', () => {
const testData: Array<any> = [
// Add your test data here, each object should have properties for quest, achievement and battlePass.
];

testData.forEach((data) => {
it(`should schedule quests correctly for ${JSON.stringify(data)}`, async () => {
jest.spyOn(questRepository, 'save').mockImplementation(() => of(data.quest));
jest.spyOn(achievementRepository, 'save').mockImplementation(() => of(data.achievement));
jest.spyOn(battlePassRepository, 'save').mockImplementation(() => of(data.battlePass));

const scheduledQuest = await service.scheduleQuests(data.quest, data.achievement, data.battlePass);

expect(scheduledQuest).toEqual(data.quest);
});
});
});
});

function createMockConnection() {
return {
createQueryBuilder: jest.fn(),
getRepository: jest.fn().mockImplementation((entity) => ({
findOneBy: jest.fn(),
save: jest.fn(),
})),
} as any;
}
