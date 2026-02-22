import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import AWS from 'aws-sdk';
import { APIGatewayEvent, Context } from 'aws-lambda';

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configure AWS SDK with your Lambda credentials and region
AWS.config.update({
accessKeyId: process.env.AWS_ACCESS_KEY,
secretAccessKey: process.env.AWS_SECRET_KEY,
region: 'us-east-1' // replace with your AWS region
});

const apiGateway = new AWS.APIGateway({apiVersion: '2018-11-29'});

app.get('/', (req, res) => {
res.send('Welcome to API Gateway');
});

app.post('/yourEndpoint', async (req, res) => {
const data = req.body;
try {
await apiGateway.putIntegration({
restApiId: process.env.API_GATEWAY_ID, // replace with your API Gateway ID
resourceId: '/yourResource', // replace with your Resource ID
httpMethod: 'POST',
integrationHttpMethod: 'POST',
type: 'AWS_PROXY',
integrationBodyType: 'json',
uri: process.env.LAMBDA_FUNCTION_URL, // replace with your Lambda Function URL
passthroughBehavior: 'WHEN_NO_MATCH',
headers: {
'Content-Type': 'application/json'
}
}).promise();

res.send('Request received');
} catch (error) {
console.error(error);
res.status(500).send(error.message);
}
});

export const handler = (event: APIGatewayEvent, context: Context) => {
return new Promise((resolve, reject) => {
app(event, context, (err: any, response) => {
if (err) {
console.error(err);
reject(err);
} else {
resolve({
statusCode: response.statusCode || 200,
body: JSON.stringify(response.body),
headers: response.headers
});
}
});
});
};
