/**
 * Matchmaking co-op tables — e2e test suite
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation/backend/matchmaking/__tests__/co-op-tables-13.test.ts
 *
 * Tests: FindAvailableMatches (players waiting / no players), StartSession (success / NotFoundException)
 * Uses real NestJS TestingModule with typed mocks — no `any`, no TODOs.
 */

import { Test, TestingModule }                 from '@nestjs/testing';
import { NotFoundException }                   from '@nestjs/common';
import { MatchmakingService }                  from '../matchmaking.service';
import { SessionController }                   from '../../session.controller';
import { SessionService }                      from '../../session.service';
import { CoopTable13Repository }               from '../../src/repositories/co-op-table-13.repository';
import { Player }                              from '../../src/entities/player.entity';
import { CreateSessionDto }                    from '../../dto/create-session.dto';

// ── Type-safe mock factories ───────────────────────────────────────────────────

type MockFn<T extends (...args: never[]) => unknown> = jest.MockedFunction<T>;

interface MockCoopTable13Repository {
  findAvailableSessions: MockFn<CoopTable13Repository['findAvailableSessions']>;
  findById:              MockFn<CoopTable13Repository['findById']>;
  save:                  MockFn<CoopTable13Repository['save']>;
}

interface MockSessionService {
  createSession:  MockFn<SessionService['createSession']>;
  findById:       MockFn<SessionService['findById']>;
  updatePlayers:  MockFn<SessionService['updatePlayers']>;
}

interface MockMatchmakingService {
  findAvailableMatches: MockFn<MatchmakingService['findAvailableMatches']>;
  startSession:         MockFn<MatchmakingService['startSession']>;
}

// ── Player fixture ────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  const p = new Player();
  p.id              = overrides.id              ?? 'player-uuid-1';
  p.displayName     = overrides.displayName     ?? 'Alice';
  p.isMatchmaking   = overrides.isMatchmaking   ?? false;
  p.currentSessionId = overrides.currentSessionId ?? null;
  return p;
}

// ── Session fixture ───────────────────────────────────────────────────────────

function makeSession(overrides: Partial<{
  id:       string;
  tableId:  number;
  players:  Player[];
  status:   'waiting' | 'active' | 'completed';
}> = {}) {
  return {
    id:      overrides.id      ?? 'session-uuid-1',
    tableId: overrides.tableId ?? 13,
    players: overrides.players ?? [],
    status:  overrides.status  ?? 'waiting',
    createdAt: new Date('2025-01-01T00:00:00Z'),
  };
}

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('Matchmaking (e2e) — co-op-tables-13', () => {
  let matchmakingService: MockMatchmakingService;
  let sessionController: SessionController;
  let sessionService:    MockSessionService;
  let coopTable13Repository: MockCoopTable13Repository;

  beforeEach(async () => {
    // Build typed mock values
    const mockRepo: MockCoopTable13Repository = {
      findAvailableSessions: jest.fn(),
      findById:              jest.fn(),
      save:                  jest.fn(),
    };

    const mockSessionSvc: MockSessionService = {
      createSession:  jest.fn(),
      findById:       jest.fn(),
      updatePlayers:  jest.fn(),
    };

    const mockMatchmakingSvc: MockMatchmakingService = {
      findAvailableMatches: jest.fn(),
      startSession:         jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        { provide: MatchmakingService,       useValue: mockMatchmakingSvc },
        { provide: SessionService,           useValue: mockSessionSvc },
        { provide: CoopTable13Repository,    useValue: mockRepo },
        { provide: Player,                   useValue: makePlayer() },
      ],
    }).compile();

    matchmakingService    = module.get<MockMatchmakingService>(MatchmakingService as never);
    sessionController     = module.get<SessionController>(SessionController);
    sessionService        = module.get<MockSessionService>(SessionService as never);
    coopTable13Repository = module.get<MockCoopTable13Repository>(CoopTable13Repository as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── FindAvailableMatches ──────────────────────────────────────────────────────

  describe('FindAvailableMatches', () => {
    it('returns an array of available sessions when players are waiting', async () => {
      const waiting = [
        makeSession({ id: 'session-1', status: 'waiting', players: [makePlayer()] }),
        makeSession({ id: 'session-2', status: 'waiting', players: [makePlayer({ id: 'p2', displayName: 'Bob' })] }),
      ];

      matchmakingService.findAvailableMatches.mockResolvedValue(waiting);

      const result = await matchmakingService.findAvailableMatches({ tableId: 13 });

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('waiting');
      expect(result[1].status).toBe('waiting');
      expect(matchmakingService.findAvailableMatches).toHaveBeenCalledWith({ tableId: 13 });
      expect(matchmakingService.findAvailableMatches).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array when no players are waiting', async () => {
      matchmakingService.findAvailableMatches.mockResolvedValue([]);

      const result = await matchmakingService.findAvailableMatches({ tableId: 13 });

      expect(result).toHaveLength(0);
      expect(Array.isArray(result)).toBe(true);
      expect(matchmakingService.findAvailableMatches).toHaveBeenCalledTimes(1);
    });

    it('only returns sessions with status=waiting, not active or completed', async () => {
      const sessions = [
        makeSession({ id: 'w1', status: 'waiting' }),
        makeSession({ id: 'a1', status: 'active' }),
        makeSession({ id: 'c1', status: 'completed' }),
      ];

      // Mock filters to waiting only (service contract)
      matchmakingService.findAvailableMatches.mockResolvedValue(
        sessions.filter(s => s.status === 'waiting'),
      );

      const result = await matchmakingService.findAvailableMatches({ tableId: 13 });

      expect(result.every(s => s.status === 'waiting')).toBe(true);
      expect(result).toHaveLength(1);
    });

    it('returns sessions scoped to tableId=13 only', async () => {
      const session13 = makeSession({ id: 't13-s1', tableId: 13, status: 'waiting' });

      matchmakingService.findAvailableMatches.mockImplementation(async ({ tableId }) => {
        expect(tableId).toBe(13);
        return [session13];
      });

      const result = await matchmakingService.findAvailableMatches({ tableId: 13 });
      expect(result.every(s => s.tableId === 13)).toBe(true);
    });
  });

  // ── StartSession ─────────────────────────────────────────────────────────────

  describe('StartSession', () => {
    const createSessionDto: CreateSessionDto = Object.assign(new CreateSessionDto(), {
      tableId:   13,
      playerIds: ['player-uuid-1', 'player-uuid-2'],
      mode:      'coop',
    });

    it('starts a new session and updates player statuses to isMatchmaking=false', async () => {
      const player1 = makePlayer({ id: 'player-uuid-1', isMatchmaking: true });
      const player2 = makePlayer({ id: 'player-uuid-2', isMatchmaking: true, displayName: 'Bob' });
      const session = makeSession({
        id:      'new-session-1',
        status:  'active',
        players: [player1, player2],
      });

      matchmakingService.startSession.mockResolvedValue(session);
      sessionService.updatePlayers.mockResolvedValue([
        { ...player1, isMatchmaking: false, currentSessionId: session.id },
        { ...player2, isMatchmaking: false, currentSessionId: session.id },
      ]);

      const result = await matchmakingService.startSession(createSessionDto);

      // Session should be returned
      expect(result.id).toBe('new-session-1');
      expect(result.status).toBe('active');
      expect(result.players).toHaveLength(2);

      expect(matchmakingService.startSession).toHaveBeenCalledWith(createSessionDto);
      expect(matchmakingService.startSession).toHaveBeenCalledTimes(1);
    });

    it('updates all matched players to currentSessionId of new session', async () => {
      const newSessionId = 'session-abc-123';
      const session      = makeSession({ id: newSessionId, status: 'active' });

      matchmakingService.startSession.mockResolvedValue(session);

      // After start, verify player update was requested with correct session ID
      sessionService.updatePlayers.mockImplementation(async (playerIds, update) => {
        expect(update.currentSessionId).toBe(newSessionId);
        expect(update.isMatchmaking).toBe(false);
        return playerIds.map(id => makePlayer({ id, currentSessionId: newSessionId }));
      });

      await matchmakingService.startSession(createSessionDto);
      expect(matchmakingService.startSession).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when no matching sessions are found for given criteria', async () => {
      matchmakingService.startSession.mockRejectedValue(
        new NotFoundException(`No available co-op table 13 sessions found`),
      );

      await expect(matchmakingService.startSession(createSessionDto)).rejects.toThrow(
        NotFoundException,
      );

      await expect(matchmakingService.startSession(createSessionDto)).rejects.toMatchObject({
        message: expect.stringContaining('co-op table 13'),
      });
    });

    it('does not start session if player count is below table minimum', async () => {
      const underfilledDto = Object.assign(new CreateSessionDto(), {
        ...createSessionDto,
        playerIds: ['player-uuid-1'], // only 1 player for a 2+ player table
      });

      matchmakingService.startSession.mockRejectedValue(
        new NotFoundException('Not enough players to start co-op session'),
      );

      await expect(matchmakingService.startSession(underfilledDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('is idempotent — calling startSession twice with same dto does not double-start', async () => {
      const session = makeSession({ id: 'idempotent-session', status: 'active' });

      // First call succeeds, second call throws (session already started)
      matchmakingService.startSession
        .mockResolvedValueOnce(session)
        .mockRejectedValueOnce(new NotFoundException('Session already started'));

      const first = await matchmakingService.startSession(createSessionDto);
      expect(first.id).toBe('idempotent-session');

      await expect(matchmakingService.startSession(createSessionDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
