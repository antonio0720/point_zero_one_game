import * as assert from 'assert';
import { startServer } from './server'; // Replace with your actual server startup function
import { test, describe } from '@jest/globals';
import { randomBytes } from 'crypto';
import axios from 'axios';
import { sleep } from './utilities'; // Replace with your actual sleep utility function

describe('Soak Tests - 10', () => {
beforeAll(async () => {
await startServer();
});

test('Test API response under load (10 requests concurrently)', async () => {
const requests = Array.from({ length: 10 }, () => axios.get('/api/test'));

// Simulate concurrent requests
const promises = requests.map(async request => {
await request;
const response = request.data;
assert.ok(response, 'API should respond');
});

// Wait for all requests to complete
await Promise.all(promises);
});

test('Test API response under load with chaos (10 random requests concurrently)', async () => {
const requests = Array.from({ length: 10 }, () => axios.get(`/api/test/${randomBytes(2).toString('hex')}`));

// Simulate concurrent requests with random paths
const promises = requests.map(async request => {
await request;
const response = request.data;
assert.ok(response, 'API should respond');
});

// Wait for all requests to complete
await Promise.all(promises);
});

test('Test API recovery after load (10 requests concurrently)', async () => {
const requests = Array.from({ length: 10 }, () => axios.get('/api/test'));

// Simulate concurrent requests
const promises = requests.map(async request => {
await request;
await sleep(500); // Replace with your actual sleep duration
const response = request.data;
assert.ok(response, 'API should respond');
});

// Wait for all requests to complete
await Promise.all(promises);
});

test('Test API recovery after chaos (10 random requests concurrently)', async () => {
const requests = Array.from({ length: 10 }, () => axios.get(`/api/test/${randomBytes(2).toString('hex')}`));

// Simulate concurrent requests with random paths
const promises = requests.map(async request => {
await request;
await sleep(500); // Replace with your actual sleep duration
const response = request.data;
assert.ok(response, 'API should respond');
});

// Wait for all requests to complete
await Promise.all(promises);
});

afterAll(async () => {
await startServer(false); // Stop the server and pass false as an argument if necessary
});
});
