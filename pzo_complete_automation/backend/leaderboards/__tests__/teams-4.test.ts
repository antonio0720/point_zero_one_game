import { Test, TestingModule } from '@nestjs/testing';
import { TeamsService } from '../teams.service';
import { LeaderboardController } from '../../controller/leaderboards.controller';
import { GetTeamsResponseDto } from '../../dto/get-teams-response.dto';
import { teamsProviders } from '../teams.providers';

describe('Leaderboards (e2e)', () => {
let app: TestingModule;
let leaderboardController: LeaderboardController;
let teamsService: TeamsService;

beforeEach(async () => {
const moduleFixture = await Test.createTestingModule({
controllers: [LeaderboardController],
providers: [...teamsProviders],
}).compile();

leaderboardController = moduleFixture.get<LeaderboardController>(LeaderboardController);
teamsService = moduleFixture.get<TeamsService>(TeamsService);
});

it('should return correct team list', async () => {
const result = await leaderboardController.getTeams();
expect(result).toBeInstanceOf(GetTeamsResponseDto);
// additional assertions for the structure and data of the GetTeamsResponseDto
});

it('should return an error if there is no team', async () => {
jest.spyOn(teamsService, 'getAllTeams').mockResolvedValueOnce([]);
const result = await leaderboardController.getTeams();
expect(result).toHaveProperty('error');
// additional assertions for the error structure and message
});
});
