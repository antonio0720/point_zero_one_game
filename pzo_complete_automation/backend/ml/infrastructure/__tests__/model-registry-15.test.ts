import { ModelRegistry } from '../model-registry';
import { IModel } from '../../interfaces/IModel';
import { DummyModel } from '../../models/dummy-model';
import { Test, TestingModule } from '@nestjs/testing';

describe('Model Registry', () => {
let modelRegistry: ModelRegistry;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [ModelRegistry],
}).compile();

modelRegistry = module.get<ModelRegistry>(ModelRegistry);
});

it('should be defined', () => {
expect(modelRegistry).toBeDefined();
});

it('should register and retrieve models', () => {
const dummyModel = new DummyModel();
modelRegistry.registerModel('dummy', dummyModel);
const retrievedModel = modelRegistry.getModel('dummy');
expect(retrievedModel).toEqual(dummyModel);
});

it('should throw an error when trying to retrieve an unknown model', () => {
expect(() => modelRegistry.getModel('unknown')).toThrowError();
});
});
