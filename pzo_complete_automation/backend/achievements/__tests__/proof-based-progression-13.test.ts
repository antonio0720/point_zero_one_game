import { AchievementsService } from '../achievements.service';
import { Quest } from '../../quests/entities/quest.entity';
import { BattlePass } from '../../battle-pass/entities/battle-pass.entity';
import { Injectable, forwardRef } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken, TypeOrmModule } from '@nestjs/typeorm';

@Injectable()
class AchievementsServiceMock {
// Implement your mock functions here
}

describe('AchievementsService', () => {
let service: AchievementsService;
let questRepository: typeof Quest;
let battlePassRepository: typeof BattlePass;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [TypeOrmModule.forRoot()],
providers: [
AchievementsService,
{ provide: AchievementsService, useClass: AchievementsServiceMock },
{ provide: getConnectionToken(), useValue(globalConnection) }, // Replace globalConnection with your actual connection instance
],
}).compile();

service = module.get<AchievementsService>(AchievementsService);
questRepository = module.get(' Quest');
battlePassRepository = module.get(' BattlePass');
});

describe('proofBasedProgression13', () => {
// Add your test cases for proof-based-progression-13 function here
});
});
