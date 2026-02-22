import * as request from 'supertest';
import app from './app'; // Assuming your application is exported from this file: ./app
import * as chai from 'chai';
import chaiHttp = require('chai-http');

// Add Chai assertions to the global `chai` object
chai.use(chaiHttp);
const expect = chai.expect;

describe('Load Testing', () => {
const baseUrl = '/';

// Define traffic profiles here
type TrafficProfile = {
name: string;
reqCount: number;
interval: number;
};

const trafficProfiles: TrafficProfile[] = [
{ name: 'Profile1', reqCount: 10, interval: 50 },
// Add more profiles as needed...
];

trafficProfiles.forEach((profile) => {
it(`Test ${profile.name}`, async () => {
const startTime = new Date().getTime();

for (let i = 0; i < profile.reqCount; i++) {
await request(app)
.get(baseUrl)
.expect(200); // Assuming your app's base route returns a 200 status code
}

const endTime = new Date().getTime();
const totalTime = (endTime - startTime) / profile.reqCount;
console.log(`${profile.name} took ${totalTime}ms per request`);
});
});
});
