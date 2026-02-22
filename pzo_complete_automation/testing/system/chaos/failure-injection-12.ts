import * as request from 'supertest';
import * as sinon from 'sinon';
import app from './app'; // assuming your express app is exported in this file

describe('Failure Injection - High Load & Delay', () => {
let agent;

beforeEach(() => {
agent = request.agent(app);
});

it('Should handle high load with a delay', async () => {
const handleResponseStub = sinon.stub(app, 'handle');

// Simulate multiple requests concurrently
for (let i = 0; i < 100; i++) {
agent.get('/').expect(200);
}

// Introduce a delay to simulate failure by slowing down the response handling function
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
sinon.replace(handleResponseStub.returns, 'response', async (_, res) => {
await delay(500); // adjust delay as needed
res.sendStatus(200);
sinon.restore();
});

// Wait for all requests to complete
await Promise.all([...Array(100).keys()].map(_ => agent.get('/').then(() => {})));
});
});
