import { HedgePairsService } from '../../services/hedge-pairs.service';
import { HedgePair, Asset } from '../../models';
import { createMockAsset, createMockHedgePair } from '../mocks';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Inject } from '@nestjs/common';

describe('HedgePairsService', () => {
let service: HedgePairsService;
let assetRepository;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
HedgePairsService,
{ provide: getRepositoryToken(Asset), useValue: jest.fn() },
],
}).compile();

service = module.get<HedgePairsService>(HedgePairsService);
assetRepository = module.get(getRepositoryToken(Asset));
});

describe('createHedgePair', () => {
it('should create a new hedge pair with assets and return it', async () => {
const mockAssetA = createMockAsset('Asset A');
const mockAssetB = createMockAsset('Asset B');

jest.spyOn(assetRepository, 'save').mockResolvedValueOnce(mockAssetA);
jest.spyOn(assetRepository, 'save').mockResolvedValueOnce(mockAssetB);
jest.spyOn(assetRepository, 'findOneBy').mockResolvedValueOnce(null);

const hedgePair = await service.createHedgePair({ assetAId: mockAssetA.id, assetBId: mockAssetB.id });

expect(hedgePair).toEqual(createMockHedgePair());
});

it('should return an error if the assets already exist in the hedge pair', async () => {
const mockAssetA = createMockAsset('Asset A');
const mockAssetB = createMockAsset('Asset B');
const existingHedgePair = createMockHedgePair({ assetA: mockAssetA, assetB: mockAssetB });

jest.spyOn(assetRepository, 'save').mockResolvedValueOnce(mockAssetA);
jest.spyOn(assetRepository, 'save').mockResolvedValueOnce(mockAssetB);
jest.spyOn(assetRepository, 'findOneBy').mockResolvedValueOnce(existingHedgePair);

const result = await service.createHedgePair({ assetAId: mockAssetA.id, assetBId: mockAssetB.id });

expect(result).toEqual(expect.objectContaining({ error: 'Assets already exist in a hedge pair' }));
});
});
});
