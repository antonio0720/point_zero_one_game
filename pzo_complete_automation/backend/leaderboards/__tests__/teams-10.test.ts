import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardService } from '../leaderboard.service';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { Team } from './entities/team.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { SocialProfile } from '../social/entities/social-profile.entity';

describe('TeamsController (e2e)', () => {
let controller: TeamsController;
let service: TeamsService;
let leaderboardService: LeaderboardService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [TeamsController],
providers: [TeamsService, LeaderboardService],
})
.overrideProvider(TeamsService)
.useValue({
create: (data: CreateTeamDto) => Promise.resolve(new Team() as Team),
findAll: () => Promise.resolve([new Team(), new Team()] as Team[]),
findOne: (id: number) => Promise.resolve(new Team() as Team),
update: (id: number, data: UpdateTeamDto) =>
Promise.resolve(new Team() as Team),
})
.overrideProvider(LeaderboardService)
.useValue({
updateTeamsPoints: jest.fn(),
})
.compile();

controller = module.get<TeamsController>(TeamsController);
service = module.get<TeamsService>(TeamsService);
leaderboardService = module.get<LeaderboardService>(LeaderboardService);
});

describe('findAll', () => {
it('should return all teams', async () => {
const result = await controller.findAll();
expect(result).toEqual([new Team(), new Team()] as Team[]);
});
});

describe('create', () => {
it('should create a team', async () => {
const createTeamDto: CreateTeamDto = new CreateTeamDto();
const createdTeam: Team = await controller.create(createTeamDto);
expect(createdTeam).toBeInstanceOf(Team);
});
});

describe('findOne', () => {
it('should return a team', async () => {
const result = await controller.findOne(1);
expect(result).toBeInstanceOf(Team);
});
});

describe('update', () => {
it('should update a team', async () => {
const updateTeamDto: UpdateTeamDto = new UpdateTeamDto();
const result = await controller.update(1, updateTeamDto);
expect(result).toBeInstanceOf(Team);
});
});

describe('updateTeamsPoints', () => {
it('should call the leaderboardService updateTeamsPoints method with teams and updated points', async () => {
const team1: Team = new Team();
const team2: Team = new Team();
const updatedPoints: number[] = [10, 20];

await controller.updateTeamsPoints([team1, team2], updatedPoints);

expect(leaderboardService.updateTeamsPoints).toHaveBeenCalledWith([team1, team2], updatedPoints);
});
});
});
