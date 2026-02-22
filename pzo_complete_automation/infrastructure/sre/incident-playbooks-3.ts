import express from 'express';
import promClient from 'prom-client';
import log4ts from 'log4ts';
import winston from 'winston';
const app = express();
const metrics = new promClient.Registry();
const logger: log4ts.Logger = log4ts.getLogger('IncidentPlaybooks');
const exporter = new promClient.TextfileExporter({ filename: './metrics.prom' });

// Register metrics
const httpRequestCount = new promClient.Gauge({ name: 'http_request_count', help: 'Number of HTTP requests received.' });
const httpRequestLatency = new promClient.Histogram({
name: 'http_request_latency_ms',
help: 'Histogram of HTTP request latencies in milliseconds.',
labelNames: ['status_code']
});

app.get('/', (req, res) => {
const start = process.hrtime();
httpRequestCount.inc();
res.send('Hello World!');
const duration = process.hrtime(start);
httpRequestLatency.observe({ ms: duration[0] * 1e3 + duration[1], status_code: 200 });
});

// Start HTTP server and export metrics
const port = process.env.PORT || 3000;
app.listen(port, () => {
logger.info(`Server started on port ${port}`);
exporter.start();
});
