import { AchievementService } from '../../achievements/achievement.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { User } from 'src/users/entities/user.entity';
import { QuestService } from '../../quests/quest.service';
import { BattlePassService } from '../../battle-pass/battle-pass.service';
import { SeasonalRewardsService } from './seasonal-rewards.service';

describe('SeasonalRewardsService', () => {
let service: SeasonalRewardsService;
let user: User;
let achievementService: AchievementService;
let questService: QuestService;
let battlePassService: BattlePassService;

beforeEach(async () => {
const module = await Test.createTestingModule({
providers: [
SeasonalRewardsService,
{ provide: AchievementService, useValue: jest.fn() },
{ provide: QuestService, useValue: jest.fn() },
{ provide: BattlePassService, useValue: jest.fn() },
],
})
.overrideProvider(GetUser)
.useValue({ id: 1, username: 'testUser' } as User)
.compile();

service = module.get<SeasonalRewardsService>(SeasonalRewardsService);
achievementService = module.get<AchievementService>(AchievementService);
questService = module.get<QuestService>(QuestService);
battlePassService = module.get<BattlePassService>(BattlePassService);
});

describe('claimRewards', () => {
it('should claim seasonal rewards and update user achievements, quests, and battle pass', async () => {
// setup
const rewardId = 1;
achievementService.updateAchievementProgress.mockResolvedValue(true);
questService.completeQuest.mockResolvedValue(true);
battlePassService.incrementLevelAndUnlockRewards.mockResolvedValue(true);

// test
await service.claimRewards(rewardId);

// verify
expect(achievementService.updateAchievementProgress).toHaveBeenCalledWith(1, rewardId);
expect(questService.completeQuest).toHaveBeenCalled();
expect(battlePassService.incrementLevelAndUnlockRewards).toHaveBeenCalled();
});

it('should throw an UnauthorizedException if user is not authenticated', async () => {
// setup (no user provided)

// test
await expect(service.claimRewards(1)).rejects.toThrow(UnauthorizedException);
});
});
});
