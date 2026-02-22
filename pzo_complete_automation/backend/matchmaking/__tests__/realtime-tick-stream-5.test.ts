import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeTickStreamService } from './realtime-tick-stream.service';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { SessionsService } from '../sessions/sessions.service';
import { SessionRepository } from '../sessions/session.repository';
import { TickStreamEventEmitter } from '../events/tick-stream-event-emitter';
import { getModelToken, Inject, Type } from '@nestjs/common';
import { Model } from 'mongoose';
import { MatchmakingTestHelper } from '../../test-helpers/matchmaking.test-helper';
import { SessionsTestHelper } from '../../test-helpers/sessions.test-helper';
import { TickStreamEvent } from '../events/tick-stream.event';
import { of } from 'rxjs';

describe('RealtimeTickStreamService', () => {
let realtimeTickStreamService: RealtimeTickStreamService;
let matchmakingService: MatchmakingService;
let sessionsService: SessionsService;
let sessionRepository: SessionRepository;
let tickStreamEventEmitter: TickStreamEventEmitter;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
RealtimeTickStreamService,
MatchmakingService,
SessionsService,
{
provide: SessionRepository,
useClass: SessionRepository,
},
TickStreamEventEmitter,
{
provide: getModelToken('Session'),
useValue: jasmine.createSpyObj('SessionModel', ['findOne', 'updateOne']),
},
],
}).compile();

realtimeTickStreamService = module.get<RealtimeTickStreamService>(RealtimeTickStreamService);
matchmakingService = module.get<MatchmakingService>(MatchmakingService);
sessionsService = module.get<SessionsService>(SessionsService);
sessionRepository = module.get<SessionRepository>(SessionRepository);
tickStreamEventEmitter = module.get<TickStreamEventEmitter>(TickStreamEventEmitter);
});

it('should emit a TickStreamEvent when a new match is started', async () => {
const matchmakingTestHelper = new MatchmakingTestHelper();
const sessionsTestHelper = new SessionsTestHelper();

const startMatchMock = jest.spyOn(matchmakingService, 'startMatch');
const createSessionMock = jest.spyOn(sessionsService, 'createSession');
const findOneMock = jest.spyOn(sessionRepository, 'findOne');
const updateOneMock = jest.spyOn(sessionRepository, 'updateOne');

startMatchMock.mockResolvedValue(matchmakingTestHelper.getStartedMatch());
createSessionMock.mockResolvedValue(sessionsTestHelper.getCreatedSession());
findOneMock.mockResolvedValueOnce(null);
updateOneMock.mockResolvedValue({ result: {} });

tickStreamEventEmitter.onTickStream.subscribe((event) => {
expect(event).toEqual(jasmine.any(TickStreamEvent));
});

await realtimeTickStreamService.handleStartMatch(matchmakingTestHelper.getStartedMatch());

expect(startMatchMock).toHaveBeenCalledTimes(1);
expect(createSessionMock).toHaveBeenCalledTimes(1);
expect(findOneMock).toHaveBeenCalledTimes(1);
expect(updateOneMock).toHaveBeenCalledTimes(1);
});

it('should emit a TickStreamEvent when an existing session is updated', async () => {
const matchmakingTestHelper = new MatchmakingTestHelper();
const sessionsTestHelper = new SessionsTestHelper();

const findOneMock = jest.spyOn(sessionRepository, 'findOne');
const updateOneMock = jest.spyOn(sessionRepository, 'updateOne');

findOneMock.mockResolvedValueOnce(sessionsTestHelper.getExistingSession());
updateOneMock.mockResolvedValue({ result: {} });

tickStreamEventEmitter.onTickStream.subscribe((event) => {
expect(event).toEqual(jasmine.any(TickStreamEvent));
});

await realtimeTickStreamService.handleUpdateSession(sessionsTestHelper.getUpdatedSession());

expect(findOneMock).toHaveBeenCalledTimes(1);
expect(updateOneMock).toHaveBeenCalledTimes(1);
});

it('should not emit a TickStreamEvent when the session is not found', async () => {
const matchmakingTestHelper = new MatchmakingTestHelper();
const sessionsTestHelper = new SessionsTestHelper();

const findOneMock = jest.spyOn(sessionRepository, 'findOne');

findOneMock.mockResolvedValueOnce(null);

tickStreamEventEmitter.onTickStream.subscribe((event) => {
expect(event).toBeNull();
});

await realtimeTickStreamService.handleUpdateSession(sessionsTestHelper.getUpdatedSession());

expect(findOneMock).toHaveBeenCalledTimes(1);
});
});
