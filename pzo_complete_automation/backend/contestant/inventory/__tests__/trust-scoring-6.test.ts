import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ContestantCoreModule } from '../contestant-core.module';
import { TrustScoringService } from './trust-scoring.service';
import { Contestant, ContestantDocument } from '../../contestant/schemas/contestant.schema';
import { Reputation } from '../../enums/reputation.enum';
import { CreateContestantDto } from '../../dtos/create-contestant.dto';
import { UpdateContestantDto } from '../../dtos/update-contestant.dto';

describe('TrustScoringService', () => {
let service: TrustScoringService;
let contestantModel: ContestantDocument;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [ContestantCoreModule],
}).compile();

service = module.get<TrustScoringService>(TrustScoringService);
contestantModel = module.get(getModelToken(Contestant.name));
});

describe('calculateTrustScore', () => {
it('should calculate trust score correctly for a new contestant', async () => {
const createContestantDto: CreateContestantDto = {
firstName: 'John',
lastName: 'Doe',
email: 'johndoe@example.com',
password: 'password123',
phoneNumber: '555-1234',
location: { latitude: 40.7128, longitude: -74.0060 },
};

const createdContestant = await service.createContestant(createContestantDto);

expect(createdContestant.trustScore).toEqual(Reputation.UNVERIFIED);
});

it('should increase trust score when a contestant makes a successful trade', async () => {
const createContestantDto: CreateContestantDto = {
firstName: 'John',
lastName: 'Doe',
email: 'johndoe@example.com',
password: 'password123',
phoneNumber: '555-1234',
location: { latitude: 40.7128, longitude: -74.0060 },
};

const createdContestant = await service.createContestant(createContestantDto);

const updateContestantDto: UpdateContestantDto = {
id: createdContestant._id,
tradeSuccess: true,
};

await service.updateContestant(updateContestantDto);

const updatedContestant = await contestantModel.findById(createdContestant._id);

expect(updatedContestant.trustScore).toEqual(Reputation.BEGINNER);
});

it('should decrease trust score when a contestant makes a fraudulent trade', async () => {
const createContestantDto: CreateContestantDto = {
firstName: 'John',
lastName: 'Doe',
email: 'johndoe@example.com',
password: 'password123',
phoneNumber: '555-1234',
location: { latitude: 40.7128, longitude: -74.0060 },
};

const createdContestant = await service.createContestant(createContestantDto);

const updateContestantDto: UpdateContestantDto = {
id: createdContestant._id,
tradeSuccess: false,
fraudulentTradeCount: 1,
};

await service.updateContestant(updateContestantDto);

const updatedContestant = await contestantModel.findById(createdContestant._id);

expect(updatedContestant.trustScore).toEqual(Reputation.SUSPICIOUS);
});
});
});
