import { FeatureStore } from '../feature-store';
import { InMemoryDatastore } from '../../datastores/in-memory';
import { IFeature, FeatureId } from '../../types';

jest.mock('../../datastores/in-memory');

describe('FeatureStore', () => {
let featureStore: FeatureStore;
let datastore: jest.Mocked<InMemoryDatastore>;

beforeEach(() => {
datastore = new InMemoryDatastore() as jest.Mocked<InMemoryDatastore>;
featureStore = new FeatureStore(datastore);
});

it('should save a feature', () => {
const feature: IFeature = {
id: new FeatureId('test-id'),
name: 'test-name',
value: 'test-value',
};

featureStore.save(feature);

expect(datastore.saveFeature).toHaveBeenCalledWith(feature);
});

it('should load a feature by id', () => {
const featureId = new FeatureId('test-id');
const savedFeature: IFeature = {
id: featureId,
name: 'test-name',
value: 'test-value',
};

datastore.getFeatureById.mockReturnValue(savedFeature);

const loadedFeature = featureStore.loadById(featureId);

expect(loadedFeature).toEqual(savedFeature);
});
});
