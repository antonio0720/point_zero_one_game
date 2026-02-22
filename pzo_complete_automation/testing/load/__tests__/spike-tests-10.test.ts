import { test, expect } from '@jest/globals';
import { Client } from 'redis';
import { createTestRedisCluster, createRandomString } from './utilities';

let client: Client;
const nodes = Array(10).fill(null).map(() => createTestRedisNode());
const cluster = createTestRedisCluster(nodes);

beforeAll(async () => {
client = new Client({ cluster });
await client.connect();
});

afterAll(async () => {
await client.disconnect();
});

test('Spike Tests - 10', async () => {
const operations = 10_000;
const requestsPerSecond = 1000;

const startTime = Date.now();
const requestInterval = 1 / requestsPerSecond;

let totalRequests = 0;
let currentTime = startTime;

const sendRequest = async () => {
if (currentTime - startTime < operations * requestInterval) {
await new Promise((resolve) => setTimeout(resolve, currentTime - startTime));
}

totalRequests += 1;
await client.set('key' + totalRequests, createRandomString());
currentTime += requestInterval;
};

for (let i = 0; i < requestsPerSecond; i++) {
setTimeout(sendRequest, i * requestInterval);
}

// Wait for all requests to complete and check the results
await new Promise((resolve) => setTimeout(resolve, operations * requestInterval));

const endTime = Date.now();
expect(totalRequests).toBe(operations);
console.log(`Completed ${totalRequests} requests in ${endTime - startTime}ms`);
});
