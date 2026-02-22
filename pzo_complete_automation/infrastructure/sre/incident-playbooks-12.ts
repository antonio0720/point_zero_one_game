import * as express from 'express';
import * as winston from 'winston';
import * as promClient from 'prom-client';
import { AlertManager } from 'alertmanager-client';

// Initialize app, metrics and loggers
const app = express();
const metrics = new Map<string, promClient.Gauge>();
const logger = winston.createLogger({
level: 'info',
format: winston.format.json(),
transports: [
new winston.transports.Console()
]
});

// Metrics registration
promClient.register(new promClient.Gauge({ name: 'requests_total', help: 'Total number of requests' }));
metrics.set('requests_total', promClient.gaugeFrom(promClient.Registry).get('requests_total'));

// Request handling with metrics and logs
app.get('/', (req, res) => {
const requestId = req.headers['x-request-id'];
metrics.get('requests_total')!.inc();
logger.info(`Request received with ID: ${requestId}`);
res.send('Hello World!');
});

// AlertManager configuration
const amConfig = {
protocol: 'http',
host: 'alertmanager-server',
port: 9093,
};
const alertManager = new AlertManager(amConfig);

// Incident playbook for high requests_total alerts
alertManager.on('incident.rules', (event) => {
if (event.ruleId === 'high-requests') {
logger.warn(`Incident: High number of requests - ${event.stateChanges[0].value1}`);
// Take remediation actions such as restarting the server, scaling up, etc.
}
});

app.listen(3000, () => {
logger.info('Server started on port 3000');
});
