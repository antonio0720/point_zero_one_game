import { Test, TestingModule } from '@nestjs/testing';
import { getConnection, Connection, Repository } from 'typeorm';
import { Team } from '../entities/team.entity';
import { LeaderboardService } from './leaderboard.service';
import { TeamService } from './team.service';
import { UserService } from '../user/user.service';
import { TeamController } from '../controller/team.controller';
import { User } from '../user/entities/user.entity';
import { UserRepository } from '../user/repositories/user.repository';
import { TeamRepository } from './repositories/team.repository';
import { CreateTeamDto, UpdateTeamDto } from '../dto/create-team.dto';
import { JwtService } from '@nestjs/jwt';

describe('Teams Leaderboards', () => {
let connection: Connection;
let teamRepository: Repository<Team>;
let userRepository: UserRepository;
let teamService: TeamService;
let leaderboardService: LeaderboardService;
let jwtService: JwtService;
let moduleRef: TestingModule;

beforeAll(async () => {
const app = await Test.createTestingModule({
controllers: [TeamController],
providers: [
TeamService,
LeaderboardService,
UserService,
JwtService,
TeamRepository,
UserRepository,
],
}).compile();

connection = app.get(Connection);
teamRepository = app.get(TeamRepository);
userRepository = app.get(UserRepository);
teamService = app.get<TeamService>(TeamService);
leaderboardService = app.get<LeaderboardService>(LeaderboardService);
jwtService = app.get<JwtService>(JwtService);
moduleRef = app;
});

afterAll(async () => {
await connection.close();
});

describe('Get Leaderboards', () => {
const testTeams: Team[] = [
// Sample team data for testing purposes
];

beforeEach(async () => {
await connection.createQueryBuilder()
.insert()
.into(Team)
.values(testTeams)
.execute();
});

it('should return correct leaderboard', async () => {
const result = await leaderboardService.getLeaderboards();
// Assert the result is as expected
});
});

describe('Create Team', () => {
const createTeamDto: CreateTeamDto = new CreateTeamDto();
// Fill in the createTeamDto with sample data for testing purposes

it('should create a new team and return created team', async () => {
const result = await teamService.createTeam(createTeamDto);
// Assert the result is as expected
});
});

describe('Update Team', () => {
const updateTeamDto: UpdateTeamDto = new UpdateTeamDto();
// Fill in the updateTeamDto with sample data for testing purposes
const teamId = 'team_id';

it('should update an existing team and return updated team', async () => {
const result = await teamService.updateTeam(teamId, updateTeamDto);
// Assert the result is as expected
});
});
});
