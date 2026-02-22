import { Test, TestingModule } from '@nestjs/testing';
import { FeatureStoreService } from '../feature-store.service';
import { FeatureStoreController } from '../feature-store.controller';
import { JestNestFactory } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FeatureStore } from 'src/ml/infrastructure/feature-store';
import { DatasetService } from 'src/ml/services/dataset.service';
import { DataProcessor } from 'src/ml/data-processing/data-processor';
import { FileStorageService } from 'src/ml/infrastructure/file-storage.service';
import { Feature } from 'src/ml/domain/Feature';
import { FeatureWithMeta } from 'src/ml/domain/FeatureWithMeta';

describe('FeatureStore (e2e)', () => {
let app: any;
let featureStoreService: FeatureStoreService;
let featureStoreController: FeatureStoreController;
let configService: ConfigService;

beforeAll(async () => {
const moduleFixture: TestingModule = await Test.createTestingModule({
controllers: [FeatureStoreController],
providers: [
FeatureStoreService,
ConfigService,
{ provide: FileStorageService, useValue: {} },
{ provide: DatasetService, useValue: {} },
{ provide: DataProcessor, useValue: {} },
],
})
.overrideProvider(FeatureStore)
.useValue({
storeData: jest.fn(),
loadData: jest.fn(),
})
.compile();

app = await JestNestFactory.createApplicationContext(moduleFixture);
featureStoreService = app.get<FeatureStoreService>(FeatureStoreService);
featureStoreController = app.get<FeatureStoreController>(FeatureStoreController);
configService = app.get<ConfigService>(ConfigService);
});

afterAll(async () => {
await app.close();
});

describe('storeData', () => {
it('should store data for a feature', async () => {
// your test code here
});
});

describe('loadData', () => {
it('should load data for a feature', async () => {
// your test code here
});
});

describe('getFeatureWithMeta', () => {
it('should return the correct feature with metadata', async () => {
// your test code here
});
});
});
