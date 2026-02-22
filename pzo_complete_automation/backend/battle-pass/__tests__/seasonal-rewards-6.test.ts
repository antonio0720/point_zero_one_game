import { Test, TestingModule } from '@nestjs/testing';
import { SeasonalRewardsService } from './seasonal-rewards.service';
import { SeasonalReward } from '../entities/seasonal-reward.entity';
import { AchievementRepository } from 'src/achievements/repositories/achievement.repository';
import { QuestRepository } from 'src/quests/repositories/quest.repository';
import { BattlePassService } from 'src/battle-pass/services/battle-pass.service';
import { getModelToken, Model } from '@nestjs/typeorm';

describe('SeasonalRewardsService', () => {
let service: SeasonalRewardsService;
let achievementRepository: AchievementRepository;
let questRepository: QuestRepository;
let battlePassService: BattlePassService;
let seasonalRewardModel: Model<SeasonalReward>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
SeasonalRewardsService,
{ provide: AchievementRepository, useValue: jest.fn() },
{ provide: QuestRepository, useValue: jest.fn() },
{ provide: BattlePassService, useValue: {} },
{
provide: getModelToken(SeasonalReward.name),
useClass: jest.fn().mockImplementation(() => seasonalRewardModel),
},
],
}).compile();

service = module.get<SeasonalRewardsService>(SeasonalRewardsService);
achievementRepository = module.get<AchievementRepository>(AchievementRepository);
questRepository = module.get<QuestRepository>(QuestRepository);
battlePassService = module.get<BattlePassService>(BattlePassService);
seasonalRewardModel = module.get(getModelToken(SeasonalReward.name));
});

// Add test cases here
});
