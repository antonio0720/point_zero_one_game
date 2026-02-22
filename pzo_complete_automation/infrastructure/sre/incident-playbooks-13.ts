import * as AWS from 'aws-sdk';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as promClient from 'prom-client';

const app = express();
app.use(bodyParser.json());

const metrics = new promClient.Gauge({ name: 'http_request_latency_seconds', help: 'HTTP request latency in seconds' });

// AWS Lambda function handler
exports.handler = async (event: any, context: any) => {
const startTime = Date.now();

// Your incident handling logic here...

metrics.set(Date.now() - startTime);
};

// Express server to expose Prometheus metrics
const port = process.env.PORT || 3000;
app.get('/metrics', (req, res) => {
res.set('Content-Type', registries.text());
res.send(registries.execute());
});

app.listen(port, () => console.log(`Listening on port ${port}`));
