import { Test, TestingModule } from '@nestjs/testing';
import { ContestantCoreModule } from '../contestant-core.module';
import { TrustScoring5Service } from './trust-scoring-5.service';
import { Contestant } from '../../entities/contestant.entity';
import { GetContestantDto } from '../../dtos/get-contestant.dto';
import { trustScoring5MockData } from './mocks/trust-scoring-5.mock';

describe('TrustScoring5Service', () => {
let service: TrustScoring5Service;
let contestant: Contestant;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [ContestantCoreModule],
})
.overrideProvider(TrustScoring5Service)
.useValue({})
.compile();

service = module.get<TrustScoring5Service>(TrustScoring5Service);
contestant = new Contestant();
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('calculateScore', () => {
it('should return the correct trust score for a newly registered contestant', () => {
const input: GetContestantDto = {
id: 'newlyRegisteredId',
firstName: 'Newly Registered',
lastName: 'Contestant',
dateOfBirth: new Date('1990-01-01'),
};

contestant.assign(input);
const expectedScore = 5;
service.resetScoring(contestant);

expect(service.calculateScore(contestant)).toEqual(expectedScore);
});

it('should return the correct trust score for a contestant with some activity', () => {
const input: GetContestantDto = {
id: 'activeContestantId',
firstName: 'Active Contestant',
lastName: 'Contestant',
dateOfBirth: new Date('1990-01-01'),
};

contestant.assign(input);

service.updateScoring(contestant, trustScoring5MockData[0]);
const expectedScore = 8;
expect(service.calculateScore(contestant)).toEqual(expectedScore);
});

it('should return the correct trust score for a contestant with high activity', () => {
const input: GetContestantDto = {
id: 'highActivityContestantId',
firstName: 'High Activity Contestant',
lastName: 'Contestant',
dateOfBirth: new Date('1990-01-01'),
};

contestant.assign(input);

service.updateScoring(contestant, trustScoring5MockData[0]);
service.updateScoring(contestant, trustScoring5MockData[1]);
const expectedScore = 9;
expect(service.calculateScore(contestant)).toEqual(expectedScore);
});

it('should return the correct trust score for a contestant with negative activity', () => {
const input: GetContestantDto = {
id: 'negativeActivityContestantId',
firstName: 'Negative Activity Contestant',
lastName: 'Contestant',
dateOfBirth: new Date('1990-01-01'),
};

contestant.assign(input);

service.updateScoring(contestant, trustScoring5MockData[2]);
const expectedScore = 4;
expect(service.calculateScore(contestant)).toEqual(expectedScore);
});
});
});
