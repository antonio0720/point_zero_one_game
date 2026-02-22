import { ChaosTestingLibrary } from 'chaostesting-library';
import { given, when, then } from 'chaostesting-ts';
import { App } from './app';
import * as chai from 'chai';
const expect = chai.expect;

describe('Chaos Engineering - 1', () => {
let chaos: ChaosTestingLibrary;
let app: App;

beforeEach(async () => {
chaos = new ChaosTestingLibrary();
app = new App();
await app.start();
});

afterEach(async () => {
await app.stop();
});

it('Load Test', async () => {
given(app.server)
.withConcurrentUsers(100)
.for(5)
.seconds()
.when()
.start();

then(async () => {
expect(app.server.getRequestCount()).to.be.greaterThan(499);
});
});

it('Stress Test', async () => {
given(app.server)
.withConcurrentUsers(1000)
.for(30)
.seconds()
.when()
.start();

then(async () => {
expect(app.server.getRequestCount()).to.be.greaterThan(29900);
});
});

it('Chaos Test - Network Latency', async () => {
given(app.server)
.withNetworkLatency([50, 100, 200]) // in ms
.for(10)
.seconds()
.when()
.start();

then(async () => {
expect(app.server.getRequestCount()).to.be.greaterThan(90);
});
});

it('Chaos Test - Random Errors', async () => {
given(app.server)
.withRateLimiterErrorPercentage(10) // 10% of requests will fail with a random error
.for(10)
.seconds()
.when()
.start();

then(async () => {
expect(app.server.getRequestCount()).to.be.greaterThan(90);
});
});
});
