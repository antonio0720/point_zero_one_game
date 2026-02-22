import { Metrics } from '@opencensus/metrics';
import * as promClient from '@opencensus/exporter-prometheus';
import { configureTracing } from './tracing';

const metrics = new Metrics();
const registry = new promClient.Registry({ prefix: 'myapp_' });
metrics.getExporters().push(new promClient.PrometheusExporter({ register: registry }));

// Define custom metrics
const requestCounter = metrics.createHistogram('http_requests', {
description: 'Number of HTTP requests made.',
unit: '1',
leakDetection: { sensitive: true },
});

const requestLatency = metrics.createSummary('http_request_latencies', {
description: 'Time taken to process HTTP requests.',
unit: 'milliseconds',
leakDetection: { sensitive: true },
});

// Example usage of the custom metrics in an HTTP server
const express = require('express');
const app = express();

let requestCount = 0;
let totalLatency = 0;
app.get('/', (req, res) => {
const startTime = Date.now();
requestCounter.observe(1); // Increment the counter by one for this request.

// Simulate some latency to demonstrate measuring it.
setTimeout(() => {
totalLatency += Date.now() - startTime;
requestLatency.observe(Date.now() - startTime); // Observe the latency for this request.
res.send('Hello, World!');
}, Math.random() * 100);
});

configureTracing();
const server = app.listen(3000, () => {
console.log(`Server listening on port ${server.address().port}`);
});
