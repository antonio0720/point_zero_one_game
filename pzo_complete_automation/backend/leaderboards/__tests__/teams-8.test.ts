import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardsService } from '../leaderboards.service';
import { TeamsController } from './teams.controller';
import { Team } from './entities/team.entity';
import { getConnectionToken } from '@nestjs/typeorm';
import { of } from 'rxjs';

describe('Teams Controller', () => {
let app: INestApplication;
let leaderboardsService: LeaderboardsService;
let teamRepository: any;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
controllers: [TeamsController],
providers: [LeaderboardsService, Team],
})
.overrideProvider(getConnectionToken())
.useValue(mockConnection())
.compile();

app = moduleFixture.createNestApplication();
leaderboardsService = moduleFixture.get<LeaderboardsService>(LeaderboardsService);
teamRepository = moduleFixture.get<any>(Team);
await app.init();
});

afterAll(async () => {
await app.close();
});

describe('when getting the top 8 teams', () => {
it('should return the top 8 teams from the leaderboard', async () => {
const mockTeams = [/* array of Team mocks */];
jest.spyOn(leaderboardsService, 'getTopNTeams').mockReturnValue(of(mockTeams));

const result = await leaderboardsService.getTopNTeams(8);
expect(result).toEqual(mockTeams);
});
});

describe('when adding a new team to the leaderboard', () => {
it('should add the new team and update the leaderboard', async () => {
const mockTeam: Team = /* team mock */;
jest.spyOn(teamRepository, 'save').mockResolvedValue(mockTeam);
jest.spyOn(leaderboardsService, 'updateLeaderboard').mockReturnValue(Promise.resolve());

await leaderboardsService.addNewTeamToLeaderboard(mockTeam);

expect(teamRepository.save).toHaveBeenCalledWith(mockTeam);
expect(leaderboardsService.updateLeaderboard).toHaveBeenCalled();
});
});
});

function mockConnection() {
class MockConnection {}
return new MockConnection();
}
