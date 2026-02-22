import express from 'express';
import { start } from 'prom-client';
import graphite from 'graphite-protocol';
import bodyParser from 'body-parser';

const app = express();
const registry = start().register();
const carrier = new graphite.Carrier({ host: 'grafana', port: 2003 });

// Define metrics
const httpRequestDurationHistogram = new registry.Histogram({
name: 'http_request_duration_seconds',
help: 'Histogram of HTTP request durations in seconds.',
});
const httpRequestCounter = new registry.Counter({
name: 'http_requests_total',
help: 'Total number of HTTP requests.',
});

// Middleware to record metrics
app.use(bodyParser.json());
app.use((req, res, next) => {
const startTime = Date.now();
req.on('end', () => {
httpRequestCounter.inc();
httpRequestDurationHistogram.observe(Date.now() - startTime);
});
next();
});

// Routes for your service
app.get('/', (req, res) => {
res.send('Hello World!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`MyService is listening on port ${PORT}`);
});

// Periodically send metrics to Graphite server
setInterval(() => {
carrier.write({
metrics: registry.gather().metrics,
});
}, 10000);
