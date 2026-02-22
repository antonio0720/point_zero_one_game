import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import * as faker from 'faker';
import { Server } from 'http';
import { startApp, TrafficProfile } from './your_app';

chai.use(chaiAsPromised);
const expect = chai.expect;
let server: Server;

describe('Load and Stress Testing', () => {
beforeEach(() => {
server = startApp();
});

afterEach(() => {
server.close();
});

describe('Traffic Profiles - 5', () => {
const trafficProfiles: TrafficProfile[] = [
// Replace these with your actual traffic profile definitions
{ name: 'Light', requestsPerSecond: 10 },
{ name: 'Medium', requestsPerSecond: 50 },
{ name: 'Heavy', requestsPerSecond: 100 },
{ name: 'Peak', requestsPerSecond: 200 },
{ name: 'Overload', requestsPerSecond: 400 }
];

trafficProfiles.forEach((profile) => {
it(`Should handle ${profile.name}`, async () => {
const requests = [];
for (let i = 0; i < 100; i++) {
requests.push(
chai.request(server)
.get('/')
.then((res) => {
expect(res).to.have.status(200);
})
);
}

sinon.stub(faker, 'random').returns(() => profile.requestsPerSecond);

await Promise.all(requests);
});
});
});
});
