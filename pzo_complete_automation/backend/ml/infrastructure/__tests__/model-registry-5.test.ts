import request from 'supertest';
import app from '../../../src/app';
import { Model } from '../../../src/model-registry';
import { clearDatabase, createTestModel } from '../utils/database';
import { setupApplication } from '../utils/setupApplication';

beforeAll(async () => {
await setupApplication();
});

beforeEach(async () => {
await clearDatabase();
});

describe('Model Registry', () => {
it('should register and retrieve a model', async () => {
const testModel = await createTestModel({ name: 'test-model' });
const registeredModel = await Model.get(testModel._id);

expect(registeredModel).toEqual(testModel);
});

it('should return an error if trying to register a model with existing id', async () => {
const testModel = await createTestModel({ name: 'test-model' });
const duplicateModel = await createTestModel({ name: 'test-model' });

await Model.register(duplicateModel);

const registerResponse = await request(app).post('/api/models').send(testModel);
expect(registerResponse.statusCode).toBe(409);
});

it('should return an error if trying to retrieve a non-existent model', async () => {
const nonExistentId = new ObjectId();
const getResponse = await request(app).get(`/api/models/${nonExistentId}`);

expect(getResponse.statusCode).toBe(404);
});
});
