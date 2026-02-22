import { ModelRegistry } from '../../model-registry';
import { getConnection } from 'typeorm';
import { Model } from '../../entity/Model';
import { describe, expect, it } from '@jest/globals';
import sinon from 'sinon';

describe('Model Registry', () => {
let modelRegistry: ModelRegistry;
const sandbox = sinon.createSandbox();

beforeEach(() => {
modelRegistry = new ModelRegistry();
sandbox.stub(getConnection, 'find').resolves([]);
});

afterEach(() => sandbox.restore());

it('should register a new model', async () => {
await modelRegistry.registerModel({ name: 'test-model', type: 'dummy' } as Model);
const models = await getConnection.find(Model);
expect(models).toHaveLength(1);
expect(models[0]).toEqual({ name: 'test-model', type: 'dummy' } as Model);
});

it('should update an existing model', async () => {
const existingModel = { id: 1, name: 'old-name', type: 'dummy' } as Model;
await getConnection.findOne(Model, { where: { id: 1 } })
.then((result) => result && (existingModel.id = result.id));

await modelRegistry.registerModel({ name: 'new-name', type: 'dummy' } as Model);
const updatedModel = await getConnection.findOne(Model, { where: { id: 1 } });
expect(updatedModel).toEqual({ id: existingModel.id, name: 'new-name', type: 'dummy' } as Model);
});

it('should return null when trying to register a model with an existing name', async () => {
const existingModel = { id: 1, name: 'existing-name', type: 'dummy' } as Model;
await getConnection.findOne(Model, { where: { name: 'existing-name' } })
.then((result) => result && (existingModel.id = result.id));

const result = await modelRegistry.registerModel({ name: 'existing-name', type: 'dummy' } as Model);
expect(result).toBeNull();
});

it('should return the registered model by name', async () => {
await modelRegistry.registerModel({ name: 'test-model', type: 'dummy' } as Model);
const registeredModel = await modelRegistry.getModelByName('test-model');
expect(registeredModel).toEqual({ name: 'test-model', type: 'dummy' } as Model);
});
});
