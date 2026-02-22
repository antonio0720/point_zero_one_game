import * as chai from 'chai';
import * as chaiHttp from 'chai-http';
import sinon from 'sinon';
import { app } from '../app'; // Import the Express app instance

const { expect } = chai;
chai.use(chaiHttp);

describe('Load and Stress Test - Soak Tests', () => {
let server: any;

before((done) => {
server = chai.request(app);
done();
});

afterEach(() => sinon.restore());

it('should handle multiple requests at once (stress test)', async () => {
const numberOfRequests = 100;

// Mock the API endpoint to return a constant response
const mockResponse = [{ id: 1, value: 'Test' }];
const mockApiEndpoint = sinon.stub().returns(mockResponse);

// Mock the API endpoint calls within the stress test
for (let i = 0; i < numberOfRequests; i++) {
server
.get('/api/example')
.then((res) => expect(res).to.deep.equal(mockResponse))
.catch((err) => console.error(err));
}

// Replace the actual API endpoint implementation with the mock
app.get('/api/example', mockApiEndpoint);
});

it('should handle a heavy load over time (load test)', async () => {
const interval = 1000; // Request interval in milliseconds
const requestsPerInterval = 10;
const totalRequests = requestsPerInterval * 60; // Total requests for 1 minute

let requestCount = 0;

setInterval(() => {
if (requestCount < totalRequests) {
server
.get('/api/example')
.then((res) => {
expect(res).to.deep.equal(mockResponse);
requestCount++;
})
.catch((err) => console.error(err));
}
}, interval);
});
});
