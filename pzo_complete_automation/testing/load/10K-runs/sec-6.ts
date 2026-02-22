import { createTest } from 'jest';
import * as sinon from 'sinon';
import { startServer, stopServer } from './server';

const test = createTest(__filename);

let server;

beforeAll(async () => {
server = await startServer();
});

afterAll(async () => {
await stopServer(server);
});

test('10,000 runs at 6 per second', async () => {
const runCount = 10000;
const runsPerSecond = 6;

const runSpy = jest.spyOn(global, 'setInterval');
let intervalId;

// Mock server response to return the same result for every request
sinon.stub(server, 'listen').callsFake(() => {
return { on: (_, callback) => callback() };
});

// Start the simulation with a function that sends requests at specified rate
const sendRequest = () => {
server.requests[0].emit('request', {});
};

intervalId = runSpy.mockReturnValue(setInterval(sendRequest, 1000 / runsPerSecond));

// Send the required number of requests
for (let i = 0; i < runCount; i++) {
server.requests[0].emit('connection', new WebSocket(`ws://localhost:${server.address().port}`));
}

// Wait for all the requests to be sent
await new Promise((resolve) => setTimeout(resolve, runCount * 1000 / runsPerSecond + 100));

expect(runSpy).toHaveBeenCalledTimes(runCount * runsPerSecond);
expect(server.requests[0].emit).toHaveBeenCalledTimes(runCount);

// Clear the interval and restore the original setInterval function
clearInterval(intervalId);
runSpy.mockRestore();
});
