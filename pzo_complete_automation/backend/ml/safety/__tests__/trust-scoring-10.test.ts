import { TrustScoringService } from '../trust-scoring.service';
import { createTestingModule, Test, Get } from '@nestjs/common';
import { TrustScoring10DataProvider } from '../../data-providers/trust-scoring-10.data-provider';
import { TrustScoring10Dto } from '../../dtos/trust-scoring-10.dto';

describe('TrustScoringService', () => {
let service: TrustScoringService;
let dataProvider: TrustScoring10DataProvider;

beforeEach(async () => {
const module = await createTestingModule({
providers: [
TrustScoringService,
{ provide: TrustScoring10DataProvider, useClass: TrustScoring10DataProvider },
],
}).compile();

service = module.get<TrustScoringService>(TrustScoringService);
dataProvider = module.get<TrustScoring10DataProvider>(TrustScoring10DataProvider);
});

describe('score', () => {
it('should return the correct score for a trustworthy agent', async () => {
jest.spyOn(dataProvider, 'getAgentData').mockResolvedValue({
actionsCount: 100,
successRate: 95,
violationsCount: 0,
});

const result = await service.score();
expect(result).toEqual(new TrustScoring10Dto(1));
});

it('should return the correct score for a less trustworthy agent', async () => {
jest.spyOn(dataProvider, 'getAgentData').mockResolvedValue({
actionsCount: 100,
successRate: 85,
violationsCount: 10,
});

const result = await service.score();
expect(result).toEqual(new TrustScoring10Dto(5));
});

it('should return the correct score for an untrustworthy agent', async () => {
jest.spyOn(dataProvider, 'getAgentData').mockResolvedValue({
actionsCount: 100,
successRate: 70,
violationsCount: 30,
});

const result = await service.score();
expect(result).toEqual(new TrustScoring10Dto(0));
});
});
});
