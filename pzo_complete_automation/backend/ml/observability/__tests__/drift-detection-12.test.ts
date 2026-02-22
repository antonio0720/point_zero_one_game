import { expect } from 'chai';
import { DriftDetectionService } from '../drift-detection-service';
import { InMemoryDataRepository } from '../../in-memory-data-repository';
import { DriftDetectionStrategy } from '../../strategies/drift-detection-strategy';

describe('Drift Detection', () => {
let driftDetectionService: DriftDetectionService;
let dataRepository: InMemoryDataRepository;
const trainingData = [/* ...training data array... */];
const testData = [/* ...test data array... */];

beforeEach(() => {
dataRepository = new InMemoryDataRepository();
driftDetectionService = new DriftDetectionService(new DriftDetectionStrategy(), dataRepository);
dataRepository.storeTrainingData(trainingData);
});

it('should not detect drift in initial training data', async () => {
const result = await driftDetectionService.checkDrift(testData);
expect(result).to.be.false;
});

it('should detect drift when data changes', async () => {
// Update the trainingData array with new data to simulate a change
const updatedTrainingData = [/* ...updated training data array... */];
dataRepository.storeTrainingData(updatedTrainingData);

const result = await driftDetectionService.checkDrift(testData);
expect(result).to.be.true;
});

it('should not detect drift when data remains the same', async () => {
// Revert the trainingData array to its original state
dataRepository.storeTrainingData(trainingData);

const result = await driftDetectionService.checkDrift(testData);
expect(result).to.be.false;
});
});
