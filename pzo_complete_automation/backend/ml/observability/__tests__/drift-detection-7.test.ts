import { DriftDetectionService } from '../drift-detection-service';
import { DummyDataGenerator } from '../dummy-data-generator';
import { DummyModelTrainer } from '../dummy-model-trainer';
import { expect } from 'chai';
import 'mocha';
import * as sinon from 'sinon';

describe('Drift Detection Service', () => {
let driftDetectionService: DriftDetectionService;
let dummyDataGenerator: DummyDataGenerator;
let dummyModelTrainer: DummyModelTrainer;

beforeEach(() => {
dummyDataGenerator = new DummyDataGenerator();
dummyModelTrainer = new DummyModelTrainer();
driftDetectionService = new DriftDetectionService(dummyDataGenerator, dummyModelTrainer);
});

it('should detect no-drift in normal conditions', async () => {
// Generate and train data with no drift
const initialData = dummyDataGenerator.generateInitialData();
await dummyModelTrainer.train(initialData);

const newData1 = dummyDataGenerator.generateNormalData();
const result1 = await driftDetectionService.detectDrift(newData1);

expect(result1).to.be.false;
});

it('should detect drift in anomalous conditions', async () => {
// Generate and train data with no drift
const initialData = dummyDataGenerator.generateInitialData();
await dummyModelTrainer.train(initialData);

const newData1 = dummyDataGenerator.generateNormalData();
await driftDetectionService.detectDrift(newData1);

// Generate and add anomalous data
const anomalousData = dummyDataGenerator.generateAnomalousData();
const updatedData = [...initialData, ...anomalousData];
await dummyModelTrainer.train(updatedData);

const newData2 = dummyDataGenerator.generateNormalData();
const result2 = await driftDetectionService.detectDrift(newData2);

expect(result2).to.be.true;
});

it('should handle empty data', async () => {
// Test handling of an empty data array
const emptyData: any[] = [];
const result = await driftDetectionService.detectDrift(emptyData);

expect(result).to.be.null;
});
});
