import { Test, TestingModule } from '@nestjs/testing';
import { SessionHandoffService } from './session-handoff.service';
import { CreateSessionDto } from '../dtos/create-session.dto';
import { GetSessionByIdResponseDto } from '../dtos/get-session-by-id-response.dto';
import { UpdateSessionDto } from '../dtos/update-session.dto';
import { SessionHandoffController } from './session-handoff.controller';
import { UserService } from '../../user/services/user.service';
import { SessionService } from '../services/session.service';
import { JwtService } from '@nestjs/jwt';
import { SessionRepository } from '../repositories/session.repository';
import { UserRepository } from '../../user/repositories/user.repository';
import { CreateUserDto } from '../../user/dtos/create-user.dto';
import { INestApplication, ActualWorld } from '@nestjs/common';
import { TestingNestApplicationConfig } from '@nestjs/testing/dist/testing-module';
import * as request from 'supertest';

describe('SessionHandoffController (Multi-client sync + handoff - session-handoff-5)', () => {
let app: INestApplication;
let moduleRef: TestingModule;
let sessionHandoffService: SessionHandoffService;
let userService: UserService;
let sessionService: SessionService;
let jwtService: JwtService;
let sessionRepository: SessionRepository;
let userRepository: UserRepository;

beforeAll(async () => {
const appModuleFixtures: TestingNestApplicationConfig = new TestingNestApplicationConfig({
cors: true,
});

moduleRef = await Test.createTestingModule(appModuleFixtures).compile();

app = moduleRef.createNestApplication();
app.useGlobalControllers(SessionHandoffController);

sessionHandoffService = moduleRef.get<SessionHandoffService>(SessionHandoffService);
userService = moduleRef.get<UserService>(UserService);
sessionService = moduleRef.get<SessionService>(SessionService);
jwtService = moduleRef.get<JwtService>(JwtService);
sessionRepository = moduleRef.get<SessionRepository>(SessionRepository);
userRepository = moduleRef.get<UserRepository>(UserRepository);

await app.init();
});

afterAll(async () => {
await app.close();
});

let firstUserId: string;
let secondUserId: string;

beforeEach(async () => {
// Clear database
await sessionRepository.clearSessionData();
await userRepository.clearUserData();

// Create first user
const createFirstUserDto: CreateUserDto = {
username: 'test_user1',
password: 'password1',
email: 'test_user1@example.com',
};
const createdFirstUser = await userService.create(createFirstUserDto);
firstUserId = createdFirstUser.id;

// Create second user
const createSecondUserDto: CreateUserDto = {
username: 'test_user2',
password: 'password2',
email: 'test_user2@example.com',
};
const createdSecondUser = await userService.create(createSecondUserDto);
secondUserId = createdSecondUser.id;
});

describe('Create Session (Multi-client)', () => {
it('should create a session for the first user and return its data', async () => {
const createSessionDto: CreateSessionDto = {
userId: firstUserId,
platform: 'platform1',
clientVersion: 'version1',
};
const createdSession = await sessionService.create(createSessionDto);

expect(createdSession).toBeDefined();
expect(createdSession.userId).toEqual(firstUserId);
});
});

describe('Get Session By Id (Multi-client sync)', () => {
let sessionId: string;

beforeEach(async () => {
// Create a session for the first user
const createSessionDto: CreateSessionDto = {
userId: firstUserId,
platform: 'platform1',
clientVersion: 'version1',
};
sessionId = (await sessionService.create(createSessionDto)).id;
});

it('should return the session data for the specified session Id', async () => {
const response: GetSessionByIdResponseDto = await request(app.getHttpServer())
.get(`/api/sessions/${sessionId}`)
.expect(200);

expect(response.data).toBeDefined();
expect(response.data.id).toEqual(sessionId);
});
});

describe('Update Session (Multi-client sync)', () => {
let sessionId: string;

beforeEach(async () => {
// Create a session for the first user
const createSessionDto: CreateSessionDto = {
userId: firstUserId,
platform: 'platform1',
clientVersion: 'version1',
};
sessionId = (await sessionService.create(createSessionDto)).id;
});

it('should update the session data for the specified session Id', async () => {
const updatedPlatform = 'updated_platform';
const updateSessionDto: UpdateSessionDto = {
platform: updatedPlatform,
};

await request(app.getHttpServer())
.put(`/api/sessions/${sessionId}`)
.send(updateSessionDto)
.expect(200);

const sessionData = await sessionRepository.findOneBy({ id: sessionId });
expect(sessionData?.platform).toEqual(updatedPlatform);
});
});

describe('Handoff Session (Multi-client sync)', () => {
let firstSessionId: string;
let secondSessionId: string;

beforeEach(async () => {
// Create a session for the first user
const createFirstSessionDto: CreateSessionDto = {
userId: firstUserId,
platform: 'platform1',
clientVersion: 'version1',
};
firstSessionId = (await sessionService.create(createFirstSessionDto)).id;

// Create a session for the second user
const createSecondSessionDto: CreateSessionDto = {
userId: secondUserId,
platform: 'platform2',
clientVersion: 'version2',
};
secondSessionId = (await sessionService.create(createSecondSessionDto)).id;
});

it('should handoff the first user''s session to the second user and return the new session data', async () => {
const jwtFirstUserToken = await jwtService.signAsync({ userId: firstUserId });
const response = await request(app.getHttpServer())
.post(`/api/sessions/${firstSessionId}/handoff`)
.set('Authorization', `Bearer ${jwtFirstUserToken}`)
.send({ newUserId: secondUserId })
.expect(200);

expect(response.body).toBeDefined();
expect(response.body.id).not.toEqual(firstSessionId);
expect(response.body.userId).toEqual(secondUserId);
});
});
});
