import { initTestApp } from '../../../../../tests/helpers';
import app, { IS_SERVER } from '../../../app';
import request from 'supertest';

describe('backend/runs/share-6', () => {
let testApp;

beforeAll(async () => {
testApp = await initTestApp(app);
});

afterAll(() => testApp.server && testApp.server.close());

it('should handle GET requests to /api/runs/share-6', async () => {
const res = await request(testApp.server)
.get('/api/runs/share-6')
.expect(200);

expect(res.body).toBeDefined();
});

it('should handle POST requests to /api/runs/share-6', async () => {
const data = { /* your test data */ };
const res = await request(testApp.server)
.post('/api/runs/share-6')
.send(data)
.expect(200);

expect(res.body).toBeDefined();
});
});
