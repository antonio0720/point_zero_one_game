import { Test, TestingModule } from '@nestjs/testing';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { Team, LeaderboardItem } from './entities/team.entity';
import { GetLeaderboardsResponseDto, UpdateTeamDto } from './dto';
import { INestApplication } from '@nestjs/common';
import { teamProviders, leaderboardProviders } from './team.providers';
import { TeamRepository } from 'src/repositories/team.repository';
import { Connection } from 'typeorm';

describe('Teams (e2e)', () => {
let app: INestApplication;
let service: TeamsService;
let controller: TeamsController;
let connection: Connection;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
controllers: [TeamsController],
providers: [...teamProviders, ...leaderboardProviders],
}).compile();

app = moduleFixture.createNestApplication();
service = moduleFixture.get<TeamsService>(TeamsService);
controller = moduleFixture.get<TeamsController>(TeamsController);
connection = moduleFixture.get(Connection);

await app.init();
});

afterAll(async () => {
await app.close();
});

describe('Leaderboards', () => {
const testTeam: Team = new Team();
testTeam.name = 'Test Team';
testTeam.points = 100;

it('/GET should return a leaderboard', async () => {
await service.createTeam(testTeam);

const result = await controller.getLeaderboards().toPromise();
expect(result).toBeInstanceOf(GetLeaderboardsResponseDto);
expect(result.items.length).toBeGreaterThan(0);
});

it('/PUT should update a team in the leaderboard', async () => {
const updatedTeam: UpdateTeamDto = { name: 'Updated Test Team', points: 200 };
await service.createTeam(testTeam);
const createdTeam = await service.findOne(testTeam.name);

const updatedResult = await controller.updateTeam(createdTeam.id, updatedTeam).toPromise();
expect(updatedResult).toBeInstanceOf(LeaderboardItem);
expect(updatedResult.points).toEqual(200);
});
});
});
