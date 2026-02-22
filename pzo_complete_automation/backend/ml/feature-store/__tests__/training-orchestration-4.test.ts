import { TrainingOrchestrator } from '../training-orchestration';
import { DataLoader } from '../data-loader';
import { ModelTrainer } from '../model-trainer';
import { MetricsLogger } from '../metrics-logger';
import { ArtifactStore } from '../artifact-store';

jest.mock('../data-loader');
jest.mock('../model-trainer');
jest.mock('../metrics-logger');
jest.mock('../artifact-store');

describe('TrainingOrchestrator', () => {
let orchestrator: TrainingOrchestrator;
let dataLoader: jest.Mocked<DataLoader>;
let modelTrainer: jest.Mocked<ModelTrainer>;
let metricsLogger: jest.Mocked<MetricsLogger>;
let artifactStore: jest.Mocked<ArtifactStore>;

beforeEach(() => {
dataLoader = jest.mocked(DataLoader, true);
modelTrainer = jest.mocked(ModelTrainer, true);
metricsLogger = jest.mocked(MetricsLogger, true);
artifactStore = jest.mocked(ArtifactStore, true);

orchestrator = new TrainingOrchestrator(dataLoader, modelTrainer, metricsLogger, artifactStore);
});

it('should start training with the correct sequence of steps', async () => {
const loadDataMock = dataLoader.load.mockResolvedValue({ trainingData: [], validationData: [] });
const trainModelMock = modelTrainer.train.mockResolvedValue({ trainedModel: {} });

await orchestrator.startTraining();

expect(dataLoader.load).toHaveBeenCalledTimes(1);
expect(modelTrainer.train).toHaveBeenCalledWith({ trainingData: [], validationData: [] });
// add more assertions for artifactStore and metricsLogger calls if necessary
});

it('should handle errors during data loading', async () => {
const loadDataMock = dataLoader.load.mockRejectedValue(new Error('Error while loading data'));

await expect(orchestrator.startTraining()).rejects.toThrow('Error while loading data');

expect(dataLoader.load).toHaveBeenCalledTimes(1);
// add more assertions if necessary
});

// Add more test cases as needed for testing different scenarios and edge cases
});
