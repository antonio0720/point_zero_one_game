import supertest from 'supertest';
import app from './app'; // Import your main application file here
import _ from 'lodash';
import { promisify } from 'util';

const agents = [];
const usersCount = 10;

for (let i = 0; i < usersCount; i++) {
agents.push(supertest.agent(app));
}

async function soakTest() {
const startTime = Date.now();
const duration = 60 * 60 * 1000; // 1 hour in milliseconds

while (Date.now() - startTime < duration) {
for (let agent of agents) {
agent.get('/api/endpoint') // Replace '/api/endpoint' with the actual endpoint you want to test
.expect(200);
}

await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate a delay between requests
}
}

promisify(soakTest)();
