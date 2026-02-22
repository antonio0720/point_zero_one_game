import * as AWS from 'aws-sdk';
import synapse from 'synapse';
import axios from 'axios';

const myServiceUrl = 'https://your-api-gateway-url.execute-api.region.amazonaws.com/stage/path';
const sloBreachThreshold = 100; // % of SLO breach before triggering chaos
let totalRequestsSent = 0;
let failedRequestsCount = 0;

// Configure AWS SDK
AWS.config.update({ region: 'us-west-2' });
const apigatewayManagementApi = new AWS.ApiGatewayManagementApi({ apiVersion: '2018-11-29', accessKeyId: process.env.ACCESS_KEY, secretAccessKey: process.env.SECRET_KEY });

// Configure Synapse for rate limiting and chaos injection
const syn = synapse();
syn.setRateLimit({ maxRequestsPerSecond: 50 }); // Adjust as needed
syn.on('preRequest', request => {
totalRequestsSent++;
if (totalRequestsSent * 100 / sloBreachThreshold >= failedRequestsCount) {
// Chaos injection - increase error rate for a certain period
syn.setRateLimit({ maxErrorsPercent: 30, durationSeconds: 60 });
}
});

// Send requests to my-service using axios and handle errors
const sendRequest = async () => {
try {
const response = await axios.get(myServiceUrl);
console.log(`Response status code: ${response.status}`);
} catch (error) {
console.error(`Error occurred while sending request: ${error.message}`);
failedRequestsCount++;
}
};

// Run the test for specified number of iterations
const numIterations = 1000;
for (let i = 0; i < numIterations; i++) {
sendRequest();
}
