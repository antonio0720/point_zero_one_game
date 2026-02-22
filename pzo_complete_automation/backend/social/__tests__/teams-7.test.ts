import { Test, TestingModule } from '@nestjs/testing';
import { TeamsService } from '../teams.service';
import { TeamsController } from '../teams.controller';
import { Team } from '../../entities/team.entity';
import { User } from '../../entities/user.entity';
import { getRepositoryToken, Repository } from '@nestjs/typeorm';
import { getConnection } from 'typeorm';
import { LeaderboardService } from '../leaderboards/leaderboard.service';

describe('Teams Controller (Leaderboards)', () => {
let teamsService: TeamsService;
let teamsController: TeamsController;
let leaderboardService: LeaderboardService;
let teamRepository: Repository<Team>;
let userRepository: Repository<User>;
let connection: any;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [TeamsController],
providers: [
TeamsService,
LeaderboardService,
{ provide: getRepositoryToken(Team), useValue: teamRepository },
{ provide: getRepositoryToken(User), useValue: userRepository },
],
}).compile();

teamsService = module.get<TeamsService>(TeamsService);
teamsController = module.get<TeamsController>(TeamsController);
leaderboardService = module.get<LeaderboardService>(LeaderboardService);
teamRepository = module.get<Repository<Team>>(getRepositoryToken(Team));
userRepository = module.get<Repository<User>>(getRepositoryToken(User));
connection = getConnection();
});

afterAll(async () => {
await connection.close();
});

describe('getLeaderboard', () => {
it('should return a list of teams with scores sorted in descending order', async () => {
// Insert test data here

const leaderboard = await teamsController.getLeaderboard();

expect(leaderboard.length).toBeGreaterThan(0);
expect(leaderboard[0].score).toBeGreaterThanOrEqual(leaderboard[1].score);
});
});
});
