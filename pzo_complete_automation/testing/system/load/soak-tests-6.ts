import * as _ from 'lodash';
import request from 'supertest';
import app from './app'; // Assuming you have a created Express app in 'app' file
import { random } from 'lodash';

const usersEndpoint = '/api/users';
const concurrentRequests = 100;

function sleep(ms: number) {
return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadTest() {
const startTime = Date.now();

const requestsPromises = _.times(concurrentRequests, () => {
const randomDelay = random(100, 500); // Random delay between requests (100ms - 500ms)
return sleep(randomDelay).then(() => request(app)
.get(usersEndpoint)
.expect('Content-Type', /json/)
.expect(200));
});

await Promise.all(requestsPromises);
const endTime = Date.now();
const totalTime = (endTime - startTime) / 1000;
console.log(`Completed load test with ${concurrentRequests} concurrent requests in ${totalTime} seconds.`);
}

loadTest().catch(console.error);
