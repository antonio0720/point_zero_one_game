import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CreateNestApplicationContext } from '@nestjs/core';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { TeamService } from '../src/social/team/team.service';
import { LeaderboardService } from '../src/social/leaderboards/leaderboard.service';

describe('Leaderboards (e2e)', () => {
let app: INestApplication;
let teamService: TeamService;
let leaderboardService: LeaderboardService;

beforeAll(async () => {
const moduleFixture: TestingModule = await Test.createTestingModule({
imports: [AppModule],
}).compile();

app = moduleFixture.createNestApplicationContext();
teamService = app.get<TeamService>(TeamService);
leaderboardService = app.get<LeaderboardService>(LeaderboardService);
});

afterAll(async () => {
await app.close();
});

describe('GET /leaderboards', () => {
it('/teams', async () => {
// Test case for getting leaderboard of teams
const response = await request(app.getHttpServer()).get('/leaderboards/teams');
expect(response.statusCode).toEqual(200);
});
});

describe('POST /leaderboards', () => {
it('/teams/:teamId', async () => {
// Test case for updating team's points in leaderboard
const teamId = await teamService.createTeam({ name: 'Test Team' }).then((team) => team.id);
const response = await request(app.getHttpServer())
.post(`/leaderboards/teams/${teamId}`)
.send({ points: 100 })
.expect(200);
});
});
});
