import request from 'supertest';
import app from '../../src/app';
import faker from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

describe('API failure injection tests', () => {
let server: any;

beforeAll(async () => {
server = app.listen();
});

afterAll(async () => {
server.close();
});

it('should fail when a non-existent resource is requested', async () => {
const res = await request(app)
.get(`/api/non-existent-resource`)
.expect(500);

expect(res.text).toContain('Error: Not Found');
});

it('should fail when a server error occurs', async () => {
const fakeServerError = faker.random.word();

jest.spyOn(global, 'Error').mockImplementation(() => new Error(fakeServerError));

const res = await request(app)
.get('/api/valid-resource')
.expect(500);

expect(res.text).toContain(fakeServerError);
});
});
