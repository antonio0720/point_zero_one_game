import { Test, TestingModule } from '@nestjs/testing';
import { ABAutoPromotionService } from './a-b-auto-promotion.service';
import { ABTest } from './ab-test.model';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { of } from 'rxjs';

describe('ABAutoPromotionService', () => {
let service: ABAutoPromotionService;
let abTestModel: Model<ABTest>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [ABAutoPromotionService],
}).compile();

service = module.get<ABAutoPromotionService>(ABAutoPromotionService);
abTestModel = module.get(getModelToken('ABTest'));
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('promoteVariant', () => {
const mockAbTestData: ABTest = {
name: 'test-ab-experiment',
variants: [
{ id: 'variantA', traffic: 50 },
{ id: 'variantB', traffic: 50 },
],
metrics: [],
};

it('should update the variant with highest metric score when data is available', async () => {
jest.spyOn(service, 'getLatestAbTest').mockReturnValue(of(mockAbTestData));
jest.spyOn(abTestModel, 'findOneAndUpdate').mockResolvedValue({ result: {} });

const promotedVariant = await service.promoteVariant('test-ab-experiment');

expect(promotedVariant).toEqual('variantA'); // or 'variantB' if metric score is higher for variant B
});

it('should return null when no data is available', async () => {
jest.spyOn(service, 'getLatestAbTest').mockReturnValue(of(null));

const promotedVariant = await service.promoteVariant('test-ab-experiment');

expect(promotedVariant).toBeNull();
});
});
});
