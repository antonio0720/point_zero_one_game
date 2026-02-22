import { Test, TestingModule } from '@nestjs/testing';
import { TeamsService } from '../teams.service';
import { LeaderboardController } from '../../../controller/leaderboards.controller';
import { leaderboardsProviders } from '../../../provider/leaderboards.provider';
import { TeamsRepository } from '../../../repository/teams.repository';
import { SocialNetworkRepository } from '../../social-networks/repository/social-networks.repository';
import { SocialNetworkService } from '../../social-networks/services/social-networks.service';

describe('LeaderboardsController (Teams - 6)', () => {
let controller: LeaderboardController;
let service: TeamsService;
let teamsRepository: TeamsRepository;
let socialNetworkRepository: SocialNetworkRepository;
let socialNetworkService: SocialNetworkService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [LeaderboardController],
providers: [...leaderboardsProviders, TeamsService, TeamsRepository, SocialNetworkRepository, SocialNetworkService],
}).compile();

controller = module.get<LeaderboardController>(LeaderboardController);
service = module.get<TeamsService>(TeamsService);
teamsRepository = module.get<TeamsRepository>(TeamsRepository);
socialNetworkRepository = module.get<SocialNetworkRepository>(SocialNetworkRepository);
socialNetworkService = module.get<SocialNetworkService>(SocialNetworkService);
});

it('should return all teams leaderboards (6 tests)', async () => {
// Test case 1: Return correct number of teams in the leaderboard
const mockTeams = [...Array(50).keys()].map((id) => ({ id, name: `Team ${id}`, socialNetworkCount: Math.floor(Math.random() * 100) }));
jest.spyOn(teamsRepository, 'findAll').mockReturnValue(Promise.resolve(mockTeams));
const mockSocialNetworks = [...Array(5).keys()].map((id) => ({ id, name: `Social Network ${id}` }));
jest.spyOn(socialNetworkService, 'getAll').mockReturnValue(Promise.resolve(mockSocialNetworks));
const mockLeaderboard = await controller.getTeamsLeaderboards();
expect(mockLeaderboard).toHaveLength(50);

// Test case 2: Return correct teams in the leaderboard (pagination)
jest.clearAllMocks();
jest.spyOn(teamsRepository, 'findAll').mockReturnValue(Promise.resolve(mockTeams));
jest.spyOn(socialNetworkService, 'getAll').mockReturnValue(Promise.resolve(mockSocialNetworks));
const mockPagination = { limit: 10, offset: 20 };
const mockLeaderboard = await controller.getTeamsLeaderboards(mockPagination);
expect(mockLeaderboard).toHaveLength(10);
expect(teamsRepository.findAll).toHaveBeenCalledWith({ take: 10, skip: 20 });

// Test case 3: Return correct teams in the leaderboard with custom sorting
jest.clearAllMocks();
jest.spyOn(teamsRepository, 'findAll').mockReturnValue(Promise.resolve(mockTeams));
jest.spyOn(socialNetworkService, 'getAll').mockReturnValue(Promise.resolve(mockSocialNetworks));
const mockCustomSort = { sortBy: 'name', sortOrder: 'ASC' };
const mockLeaderboard = await controller.getTeamsLeaderboards({}, mockCustomSort);
expect(mockLeaderboard).toHaveLength(50);
expect(teamsRepository.findAll).toHaveBeenCalledWith({ orderBy: ['name', 'ASC'] });

// Test case 4: Return correct teams in the leaderboard with custom sorting and pagination
jest.clearAllMocks();
jest.spyOn(teamsRepository, 'findAll').mockReturnValue(Promise.resolve(mockTeams));
jest.spyOn(socialNetworkService, 'getAll').mockReturnValue(Promise.resolve(mockSocialNetworks));
const mockCustomSortAndPagination = { sortBy: 'name', sortOrder: 'ASC' }, mockPagination = { limit: 10, offset: 20 };
const mockLeaderboard = await controller.getTeamsLeaderboards(mockPagination, mockCustomSortAndPagination);
expect(mockLeaderboard).toHaveLength(10);
expect(teamsRepository.findAll).toHaveBeenCalledWith({ take: 10, skip: 20, orderBy: ['name', 'ASC'] });

// Test case 5: Throw an error when social networks service fails
jest.clearAllMocks();
jest.spyOn(teamsRepository, 'findAll').mockReturnValue(Promise.resolve(mockTeams));
jest.spyOn(socialNetworkService, 'getAll').mockImplementationOnce(() => { throw new Error('Social Networks service error'); });
await expect(controller.getTeamsLeaderboards()).rejects.toThrow('Social Networks service error');

// Test case 6: Throw an error when teams repository fails
jest.clearAllMocks();
jest.spyOn(teamsRepository, 'findAll').mockImplementationOnce(() => { throw new Error('Teams repository error'); });
jest.spyOn(socialNetworkService, 'getAll').mockReturnValue(Promise.resolve(mockSocialNetworks));
await expect(controller.getTeamsLeaderboards()).rejects.toThrow('Teams repository error');
});
});
