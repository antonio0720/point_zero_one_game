import { Test, TestingModule } from '@nestjs/testing';
import { SessionsService } from '../sessions.service';
import { SessionRepository } from '../../repositories/session.repository';
import { MatchmakingService } from '../../matchmaking/matchmaking.service';
import { PlayerRepository } from '../../repositories/player.repository';
import { GameSessionEntity } from '../../entities/game-session.entity';
import { CreateGameSessionDto } from '../dto/create-game-session.dto';
import { SessionStatusEnum } from '../../enums/session-status.enum';
import { GetMatchmakingResultDto } from '../../matchmaking/dto/get-matchmaking-result.dto';
import { MatchmakingStrategyEnum } from '../../enums/matchmaking-strategy.enum';
import { PvPGhosts9Service } from './pvpghosts-9.service';

describe('PvPGhosts9Service', () => {
let service: PvPGhosts9Service;
let sessionsService: SessionsService;
let matchmakingService: MatchmakingService;
let playerRepository: PlayerRepository;
let sessionRepository: SessionRepository;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
PvPGhosts9Service,
SessionsService,
MatchmakingService,
PlayerRepository,
SessionRepository,
],
}).compile();

service = module.get<PvPGhosts9Service>(PvPGhosts9Service);
sessionsService = module.get<SessionsService>(SessionsService);
matchmakingService = module.get<MatchmakingService>(MatchmakingService);
playerRepository = module.get<PlayerRepository>(PlayerRepository);
sessionRepository = module.get<SessionRepository>(SessionRepository);
});

it('should create a new game session', async () => {
// given
const playersCount = 4;
const expectedGameSession: GameSessionEntity = new GameSessionEntity();
expectedGameSession.status = SessionStatusEnum.IN_PROGRESS;
expectedGameSession.strategy = MatchmakingStrategyEnum.PVPGHOSTS9;

jest.spyOn(sessionsService, 'create').mockResolvedValue(expectedGameSession);
jest.spyOn(matchmakingService, 'getMatchmakingResult').mockResolvedValue({
players: Array(playersCount).fill({ id: 1 }),
sessionId: expectedGameSession.id,
} as GetMatchmakingResultDto);

// when
const createGameSessionDto: CreateGameSessionDto = { strategy: MatchmakingStrategyEnum.PVPGHOSTS9 };
const result = await service.create(createGameSessionDto, playersCount);

// then
expect(result).toEqual(expectedGameSession);
});

it('should find a game session by id', async () => {
// given
const sessionId = 1;
const expectedSession: GameSessionEntity = new GameSessionEntity();
expectedSession.id = sessionId;

jest.spyOn(sessionRepository, 'findOne').mockResolvedValue(expectedSession);

// when
const result = await service.findById(sessionId);

// then
expect(result).toEqual(expectedSession);
});
});
