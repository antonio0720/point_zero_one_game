import { Test, TestingModule } from '@nestjs/testing';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Get, Query, Res, Req, Post, Body, UseGuards } from '@nestjs/common/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BattlePassService } from './battle-pass.service';
import { Achievement, Quest, BattlePassUser, Reward, User } from '../../entities';
import { EntityManager, InjectEntityManager } from '@nestjs/typeorm';
import { of } from 'rxjs';

describe('BattlePassService', () => {
let service: BattlePassService;
let manager: EntityManager;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
BattlePassService,
{ provide: EntityManager, useClass: EntityManager },
{
provide: User,
value: jest.fn().mockImplementation(() => ({ id: 1 })),
},
],
}).compile();

service = module.get<BattlePassService>(BattlePassService);
manager = module.get<EntityManager>(EntityManager);
});

describe('proofBasedProgression3', () => {
let user: BattlePassUser;
let achievement1: Achievement;
let quest1: Quest;
let reward1: Reward;

beforeEach(async () => {
achievement1 = await manager.save(new Achievement({ id: 1, name: 'Achievement 1' }));
quest1 = await manager.save(
new Quest({
id: 1,
name: 'Quest 1',
type: 'achievement',
achievementId: achievement1.id,
progressionType: 'proof-based-progression-3',
proofRequired: 5,
}),
);
reward1 = await manager.save(new Reward({ id: 1, name: 'Reward 1' }));

user = await manager.save(
new BattlePassUser({
id: 1,
userId: 1,
battlePassId: 1,
achievements: [achievement1],
quests: [quest1],
rewards: [],
}),
);
});

it('should update user progression when proving a quest', async () => {
const proof = 3;

await service.proveQuest(user, quest1.id, proof);

expect(user.quests[0].progress).toEqual(proof);
});

it('should unlock reward when reaching the required progress', async () => {
const proof = 5; // reaching the required progress for Quest 1 (5/5)

await service.proveQuest(user, quest1.id, proof);

expect(user.rewards).toEqual([reward1]);
});

it('should throw an error when trying to prove a non-existent quest', async () => {
const proof = 5;
const nonExistentQuestId = 2;

await expect(service.proveQuest(user, nonExistentQuestId, proof)).rejects.toEqual(
new NotFoundException('Quest not found'),
);
});
});
});
