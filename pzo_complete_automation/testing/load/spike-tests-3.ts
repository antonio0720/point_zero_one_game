import * as request from 'supertest';
import app from './app'; // Your Express.js application instance
import { sinonStub } from 'sinon';
import * as faker from 'faker';
import * as chai from 'chai';
const expect = chai.expect;
import { setupChaos, teardownChaos } from 'chaos-monkey';

describe('Spike tests - 3', () => {
let server: any;

before(async () => {
server = await app.listen(3000);
});

after(() => server.close());

describe('Load testing', () => {
it('Should handle multiple requests concurrently', async () => {
const concurrentRequests = 10;
let responseTimes: number[] = [];

for (let i = 0; i < concurrentRequests; i++) {
request(app)
.get('/')
.expect(200)
.end((err, res) => {
if (!err) responseTimes.push(res.responseTime);
});
}

await chai.assert.isAtLeast(responseTimes.length, concurrentRequests);
const avgResponseTime = responseTimes.reduce((acc, curr) => acc + curr, 0) / responseTimes.length;
expect(avgResponseTime).to.be.below(200); // Adjust the threshold according to your requirements
});
});

describe('Stress testing', () => {
it('Should handle high traffic', async () => {
const numberOfRequests = 100;

for (let i = 0; i < numberOfRequests; i++) {
request(app)
.get('/')
.expect(200);
}
});
});

describe('Chaos testing', () => {
it('Should handle random errors and failures', async () => {
sinonStub(global, 'setTimeout').callsFake(() => Promise.resolve());

setupChaos()
.networkInterruption({ percentage: 10 })
.diskFailures({ percentage: 5 })
.cpuSchedulerThrottle({ percentage: 20 })
.run();

request(app)
.get('/')
.expect(200)
.end(() => {
teardownChaos();
global.setTimeout.restore();
});
});
});
});
