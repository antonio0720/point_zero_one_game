import { Test, TestingModule } from '@nestjs/testing';
import { MatchmakingService } from '../matchmaking.service';
import { SessionController } from '../../session.controller';
import { SessionService } from '../../session.service';
import { CoopTable13Repository } from 'src/repositories/co-op-table-13.repository';
import { Player } from 'src/entities/player.entity';
import { CreateSessionDto } from '../../dto/create-session.dto';
import { NotFoundException } from '@nestjs/common';

describe('Matchmaking (e2e)', () => {
let matchmakingService: MatchmakingService;
let sessionController: SessionController;
let sessionService: SessionService;
let coopTable13Repository: CoopTable13Repository;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [SessionController],
providers: [
MatchmakingService,
SessionService,
{ provide: CoopTable13Repository, useValue: {} },
Player,
],
}).compile();

matchmakingService = module.get<MatchmakingService>(MatchmakingService);
sessionController = module.get<SessionController>(SessionController);
sessionService = module.get<SessionService>(SessionService);
coopTable13Repository = module.get<CoopTable13Repository>(CoopTable13Repository);
});

describe('FindAvailableMatches', () => {
it('should return an array of available matches when there are players waiting', async () => {
// TODO: Implement test case
});

it('should return an empty array when there are no players waiting', async () => {
// TODO: Implement test case
});
});

describe('StartSession', () => {
const createSessionDto: CreateSessionDto = new CreateSessionDto();

it('should start a new session and update player statuses', async () => {
// TODO: Implement test case
});

it('should throw NotFoundException when no matching sessions are found', async () => {
// TODO: Implement test case
});
});
});
