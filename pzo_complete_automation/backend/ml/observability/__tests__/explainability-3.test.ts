import { ExplainabilityService } from '../../explainability-service';
import { IExplainableModel } from '../../interfaces/model';
import { FeatureImportance } from '../../feature-importance';
import * as mockData from '../mocks/mock-data';

jest.mock('../../interfaces/model');
jest.mock('../../explainability-service');
jest.mock('../../feature-importance');

describe('Explainability Service', () => {
const mockModel: Partial<IExplainableModel> = {
explain: jest.fn(),
};
const explainabilityService = new ExplainabilityService(mockModel as any);

beforeEach(() => {
// Reset the mocks for each test
(FeatureImportance as jest.Mock).mockReset();
(mockData.getExplainableModel as jest.Mock).mockReturnValue(mockModel);
});

it('should return feature importance', async () => {
const featureImportanceMock = {
getFeatureImportance: jest.fn(),
};
(FeatureImportance as jest.Mock).mockReturnValue(featureImportanceMock);

mockModel.explain.mockResolvedValue({
feature_importances: [0.4, 0.3, 0.2],
});

const result = await explainabilityService.getFeatureImportance();

expect(result).toEqual([0.4, 0.3, 0.2]);
expect(mockModel.explain).toHaveBeenCalledTimes(1);
expect(featureImportanceMock.getFeatureImportance).not.toHaveBeenCalled();
});

it('should throw an error if model does not support explainability', async () => {
mockModel.explain = jest.fn().mockImplementation(() => {
throw new Error('Model does not support explainability');
});

await expect(explainabilityService.getFeatureImportance()).rejects.toThrow('Model does not support explainability');
});
});
