import * as _ from 'lodash';
import * as chai from 'chai';
import * as request from 'supertest';
import app from './app'; // Your express application instance
const expect = chai.expect;

describe('Soak Test', () => {
let concurrentRequests: any[] = [];

before(() => {
for (let i = 0; i < 100; i++) {
concurrentRequests.push(
request(app)
.get('/api/endpoint')
.delay(Math.floor(Math.random() * 50)) // Random delay between requests
.expect(200)
);
}
});

it('responds to multiple concurrent requests', (done) => {
_.chain(concurrentRequests)
.flatMap((req) => [req.response])
.each((res) => {
expect(res.status).to.equal(200);
})
.value() // Drain all responses
.then(() => done())
.catch(done);
});
});
