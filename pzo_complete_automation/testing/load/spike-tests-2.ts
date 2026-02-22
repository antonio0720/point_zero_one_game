import * as supertest from 'supertest';
import * as faker from '@faker-js/faker';
import app from './app'; // Assuming your application is named "app"

const API_URL = '/api';
let agent;
let userCount = 0;

beforeAll(async () => {
agent = supertest.agent(app);
});

describe('Load + stress + chaos testing - spike-tests-2', () => {
test('Create multiple users (stress test)', async () => {
for (let i = 0; i < 1000; i++) {
const user = await agent.post(API_URL + '/users').send({
name: faker.name.findName(),
email: faker.internet.email(),
password: faker.internet.password(),
});
expect(user.statusCode).toBe(201);
userCount++;
}
expect(userCount).toBe(1000); // Ensure all users were created successfully
});

test('Login with valid credentials (load test)', async () => {
const login = await agent.post(API_URL + '/auth/login').send({
email: faker.internet.email(),
password: faker.internet.password(),
});
expect(login.statusCode).toBe(200); // Ensure successful login
});

test('Login with invalid credentials (chaos test)', async () => {
const login = await agent.post(API_URL + '/auth/login').send({
email: faker.internet.email(),
password: 'invalid-password', // Incorrect password for the generated email
});
expect(login.statusCode).not.toBe(200); // Ensure unsuccessful login
});

test('Send excessive requests (stress test)', async () => {
const sendExcessiveRequests = async () => {
for (let i = 0; i < 10000; i++) {
await agent.get(API_URL + '/healthcheck');
}
};
await sendExcessiveRequests(); // Send excessive requests to stress the server
});

test('Verify server health after excessive requests (chaos test)', async () => {
const healthCheck = await agent.get(API_URL + '/healthcheck');
expect(healthCheck.statusCode).toBe(200); // Ensure the server is still healthy despite excessive requests
});
});
