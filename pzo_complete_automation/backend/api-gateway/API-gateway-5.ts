import * as express from 'express';
import cors from 'cors';
import AWS from 'aws-sdk';

const app = express();
app.use(cors());

// Initialize API Gateway Manager client
const apigwManager = new AWS.ApiGatewayManagementApi({
apiVersion: '2018-11-29',
region: process.env.AWS_REGION,
accessKeyId: process.env.AWS_ACCESS_KEY_ID,
secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
apiGatewayRestApiId: process.env.API_GATEWAY_REST_API_ID,
apiGatewayRestApiRootResourceId: process.env.API_GATEWAY_ROOT_RESOURCE_ID,
});

// Example of sending a request to the Lambda function from the API Gateway
app.get('/example', async (req, res) => {
try {
const data = await apigwManager.postToConnection({ ConnectionId: process.env.CONNECTION_ID }).promise();
res.send(data.Body);
} catch (error) {
console.error(error);
res.status(500).send('Error occurred');
}
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`Server started on port ${PORT}`);
});
