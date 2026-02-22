import { FeatureStore } from '../feature-store';
import { DatabaseClient } from '../../database/database-client';
import { MockedResponse, MockDate } from 'jest-mock';
import dayjs from 'dayjs';

jest.mock('../../database/database-client');
jest.mock('dayjs');

const mocks = new Map<string, MockedResponse>();

beforeAll(() => {
// Set up global mocks
});

afterEach(() => {
// Clear mock responses after each test
mocks.clear();
});

describe('FeatureStore', () => {
let featureStore: FeatureStore;
let dbClientMock: jest.Mocked<DatabaseClient>;
let dateMock: jest.Mocked<typeof dayjs>;

beforeEach(() => {
// Initialize the FeatureStore and mocks for each test
dbClientMock = jest.mock(DatabaseClient, true);
dateMock = jest.mock(dayjs);
featureStore = new FeatureStore(dbClientMock as any);
});

it('should load features', async () => {
// Arrange
const mockFeatures: any = {};
dbClientMock.getAll.mockResolvedValueOnce([mockFeatures]);

// Act
const loadedFeatures = await featureStore.loadFeatures();

// Assert
expect(loadedFeatures).toEqual(mockFeatures);
});

it('should save features', async () => {
// Arrange
const mockFeatures: any = {};
dbClientMock.save.mockResolvedValueOnce();

// Act
await featureStore.saveFeatures(mockFeatures);

// Assert
expect(dbClientMock.save).toHaveBeenCalledWith(mockFeatures);
});
});
