import { Test, TestingModule } from '@nestjs/testing';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { Team, TeamLeaderboardResponse } from './interfaces';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Connection } from 'typeorm/entity-metadata-manager';
import { createConnection, CloseOptions } from 'typeorm';
import { faker } from '@faker-js/faker';

describe('Teams Controller', () => {
let connection: Connection;
let teamRepository: Repository<Team>;
let teamsService: TeamsService;
let teamsController: TeamsController;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [TeamsController],
providers: [TeamsService],
})
.overrideProvider(getRepositoryToken(Team))
.useValue(teamRepository)
.compile();

teamsService = module.get<TeamsService>(TeamsService);
teamsController = module.get<TeamsController>(TeamsController);
connection = createConnection({
// add your connection configurations here
});
teamRepository = connection.getRepository(Team);
});

beforeEach(async () => {
await connection.createQueryBuilder('team', 't')
.delete()
.where('t.id IS NOT NULL')
.execute();
});

afterAll(async (done) => {
await connection.close().then(() => done()).catch((e) => done(e));
});

describe('leaderboards', () => {
it('should return the top 5 teams with the most points', async () => {
const team1 = new Team();
team1.name = faker.team.professionalSports().name;
team1.points = faker.datatype.number({ min: 0, max: 100 });
await teamRepository.save(team1);

const team2 = new Team();
team2.name = faker.team.professionalSports().name;
team2.points = faker.datatype.number({ min: 50, max: 150 });
await teamRepository.save(team2);

const team3 = new Team();
team3.name = faker.team.professionalSports().name;
team3.points = faker.datatype.number({ min: 75, max: 150 });
await teamRepository.save(team3);

const team4 = new Team();
team4.name = faker.team.professionalSports().name;
team4.points = faker.datatype.number({ min: 75, max: 120 });
await teamRepository.save(team4);

const teamLeaderboardResponse: TeamLeaderboardResponse[] = await teamsController.getLeaderboards().then((data) => data);

expect(teamLeaderboardResponse.length).toEqual(5); // add more assertions as needed
});
});
});
