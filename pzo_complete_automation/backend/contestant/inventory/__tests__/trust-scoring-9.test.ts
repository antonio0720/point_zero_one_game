import { Test, TestingModule } from '@nestjs/testing';
import { ContestantService } from '../contestant.service';
import { Contestant } from '../../entities/contestant.entity';
import { TrustScoring9Strategy } from './trust-scoring-9.strategy';
import { getConnection, In } from 'typeorm';
import { ContestantRepository } from '../../repositories/contestant.repository';
import { TrustScoring9Service } from './trust-scoring-9.service';
import { TrustScoring9Dto } from './dto/trust-scoring-9.dto';

describe('Contestant (e2e)', () => {
let contestantService: ContestantService;
let trustScoring9Service: TrustScoring9Service;
let contestsData: Contestant[];
let trustScoring9StrategyInstance: TrustScoring9Strategy;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [ContestantService, TrustScoring9Service],
}).compile();

contestantService = module.get<ContestantService>(ContestantService);
trustScoring9Service = module.get<TrustScoring9Service>(TrustScoring9Service);

const repository = module.get<ContestantRepository>(ContestantRepository);
contestsData = await getConnection()
.createQueryBuilder(Contestant, 'contestants')
.where('contestants.id IN (:...ids)', { ids: ['1', '2', '3'] })
.getMany();

trustScoring9StrategyInstance = new TrustScoring9Strategy();
});

describe('Trust Scoring 9', () => {
it('should calculate trust scores correctly', async () => {
const trustScores = await contestantService.calculateTrustScores(contestsData, trustScoring9StrategyInstance);

// Add test assertions for each contestant's trust score
});
});

describe('Update Trust Scores', () => {
it('should update trust scores correctly', async () => {
const updatedTrustScores: TrustScoring9Dto[] = [
// Add example updated trust scores for each contestant
].map((score) => ({ contestantId: score.contestantId, trustScore: score.trustScore }));

await trustScoring9Service.updateTrustScores(updatedTrustScores);

const newTrustScores = await contestantService.getContestants();

// Add test assertions for each updated trust score in the new list of contestants
});
});
});
