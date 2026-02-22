import { Test, TestingModule } from '@nestjs/testing';
import { ContestantService } from './contestant.service';
import { ContestantRepository } from './contestant.repository';
import { TrustScoring1Service } from './trust-scoring-1.service';
import { TrustScoreDto } from './dto/trust-score.dto';

describe('TrustScoring1Service', () => {
let service: TrustScoring1Service;
let contestantRepository: ContestantRepository;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
TrustScoring1Service,
ContestantService,
{ provide: ContestantRepository, useValue: {} },
],
}).compile();

service = module.get<TrustScoring1Service>(TrustScoring1Service);
contestantRepository = module.get<ContestantRepository>(ContestantRepository);
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('calculateTrustScore', () => {
const testCases: Array<[number[], number]> = [
// Add your test cases here, each as an array where the first element is an array of contestant actions and the second element is the expected trust score.
];

testCases.forEach(([actions, expectedScore]) => {
it(`should return correct trust score for ${JSON.stringify(actions)}`, async () => {
// Setup the mock data for contestant actions
const mockContestantActions = [...actions];
(contestantRepository as any).findOne = jest.fn().mockResolvedValue({
id: 1,
actions: mockContestantActions,
});

// Call the function under test and store the result
const trustScoreResult = await service.calculateTrustScore(1);

// Check if the returned trust score matches the expected one
expect(trustScoreResult).toEqual(new TrustScoreDto(expectedScore));
});
});
});
});
