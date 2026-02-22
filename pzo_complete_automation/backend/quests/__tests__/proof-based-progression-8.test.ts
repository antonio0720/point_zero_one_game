import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AchievementsService } from '../../achievements/achievement.service';
import { QuestsService } from '../../quests/quest.service';
import { BattlePassService } from '../battle-pass.service';
import { ProgressionService } from './progression.service';
import { IProgressionRepository } from './progression.repository';

describe('ProgressionService', () => {
let service: ProgressionService;
let progressionRepository: Partial<IProgressionRepository>;
let achievementsService: any;
let questsService: any;
let battlePassService: any;

beforeEach(async () => {
const module = await Test.createTestingModule({
providers: [
ProgressionService,
{ provide: IProgressionRepository, useValue: progressionRepository },
AchievementsService,
QuestsService,
BattlePassService,
],
}).compile();

service = module.get<ProgressionService>(ProgressionService);
achievementsService = module.get(AchievementsService);
questsService = module.get(QuestsService);
battlePassService = module.get(BattlePassService);
});

describe('validateProofBasedProgression', () => {
it('should return true when all conditions are met', async () => {
jest.spyOn(achievementsService, 'hasAchievement').mockReturnValue(true);
jest.spyOn(questsService, 'isQuestCompleted').mockReturnValue(true);
jest.spyOn(battlePassService, 'isBattlePassActive').mockReturnValue(true);

expect(await service.validateProofBasedProgression()).toBeTruthy();
});

it('should return false when at least one condition is not met', async () => {
jest.spyOn(achievementsService, 'hasAchievement').mockReturnValue(false);

expect(await service.validateProofBasedProgression()).toBeFalsy();
});
});

describe('updatePlayerProgression', () => {
it('should update player progression when proof-based progression is validated', async () => {
jest.spyOn(achievementsService, 'hasAchievement').mockReturnValue(true);
jest.spyOn(questsService, 'isQuestCompleted').mockReturnValue(true);
jest.spyOn(battlePassService, 'isBattlePassActive').mockReturnValue(true);

const playerId = 1;
await service.updatePlayerProgression(playerId);

expect(progressionRepository.update).toHaveBeenCalledWith({ where: { playerId }, data: {} };
});

it('should throw an exception when proof-based progression is not validated', async () => {
jest.spyOn(achievementsService, 'hasAchievement').mockReturnValue(false);

const playerId = 1;
await expect(service.updatePlayerProgression(playerId)).rejects.toThrow(UnauthorizedException);
});
});
});
