import { Test, TestingModule } from '@nestjs/testing';
import { SessionsService } from '../sessions.service';
import { Session } from '../../entities/session.entity';
import { MatchmakingService } from 'src/matchmaking/matchmaking.service';
import { Player } from '../../entities/player.entity';
import { Inject, OnModuleInit } from '@nestjs/common';
import { GetRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSessionDto } from '../dto/create-session.dto';
import { UpdateSessionDto } from '../dto/update-session.dto';

describe('SessionsService (PvP-ghosts-4)', () => {
let service: SessionsService;
let sessionRepository: Repository<Session>;
let playerRepository: Repository<Player>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [SessionsService, MatchmakingService],
imports: [],
})
.overrideProvider(GetRepository)
.useClass(() => {
return jest.fn().mockImplementation((entity) => ({
findOne: jest.fn(),
find: jest.fn(),
save: jest.fn(),
create: jest.fn(),
} as any))
})
.compile();

service = module.get<SessionsService>(SessionsService);
sessionRepository = module.get(GetRepository(Session));
playerRepository = module.get(GetRepository(Player));
});

describe('create', () => {
it('should create a new session with given players', async () => {
const players: Player[] = [
// Mock player objects here
];
jest.spyOn(playerRepository, 'find').mockResolvedValue(players);

const createSessionDto: CreateSessionDto = {
// Session data here
};

const result = await service.create(createSessionDto);
expect(result).toBeInstanceOf(Session);
});
});

describe('join', () => {
it('should join a player to an existing session if available', async () => {
const session: Session = new Session();
// Mock session data here

jest.spyOn(sessionRepository, 'findOne').mockResolvedValue(session);

const player: Player = new Player();
// Mock player data here

const result = await service.join(player);
expect(result).toBe(true);
});

it('should return false if no session is available for join', async () => {
jest.spyOn(sessionRepository, 'findOne').mockResolvedValue(null);

const player: Player = new Player();
// Mock player data here

const result = await service.join(player);
expect(result).toBe(false);
});
});

describe('leave', () => {
it('should remove a player from the session', async () => {
const session: Session = new Session();
// Mock session data here
const player: Player = new Player();
// Mock player data here

jest.spyOn(session, 'removePlayer').mockImplementation(() => {});
jest.spyOn(sessionRepository, 'save').mockResolvedValue(session);

await service.leave(player);
});
});

describe('update', () => {
it('should update the given session with provided data', async () => {
const session: Session = new Session();
// Mock session data here
const updateSessionDto: UpdateSessionDto = {
// Session data here
};

jest.spyOn(sessionRepository, 'findOne').mockResolvedValue(session);
jest.spyOn(sessionRepository, 'save').mockResolvedValue(session);

await service.update(session.id, updateSessionDto);
});
});
});
