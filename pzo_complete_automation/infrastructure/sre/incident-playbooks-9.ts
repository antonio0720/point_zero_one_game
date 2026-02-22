import * as aws from 'aws-sdk';
import * as _ from 'lodash';
import * as express from 'express';
import * as promclient from 'prom-client';

// Initialize required services
const cloudwatch = new aws.CloudWatch({ region: 'us-west-2' });
const ec2 = new aws.EC2({ region: 'us-west-2' });
const app = express();

// Metrics registration
const metricFamily = new promclient.MetricFamily('IncidentPlaybook', 'Observability metrics for the incident playbook');
const totalRequests = new promclient.Gauge({ name: 'total_requests', help: 'Total number of requests' });
const failedRequests = new promclient.Gauge({ name: 'failed_requests', help: 'Number of failed requests' });
const activeIncidents = new promclient.Gauge({ name: 'active_incidents', help: 'Number of active incidents' });

metricFamily.addMetrics(totalRequests, failedRequests, activeIncidents);
promclient.register.apply(null, [metricFamily]);

// Route for recording requests and incident status
app.get('/', async (req, res) => {
totalRequests.inc();

try {
// Simulate an incident based on a condition
if (Math.random() > 0.95) {
activeIncidents.set(activeIncidents.get() + 1);
console.error('Simulated incident detected');
failedRequests.inc();
throw new Error('Simulated incident error');
} else {
res.send('No incident detected');
totalRequests.inc();
}
} catch (err) {
console.error(err);
failedRequests.inc();
res.status(500).send(err.message);
}
});

// CloudWatch Logs exporter for AWS Lambda
const logs = new aws.Logs({ region: 'us-west-2' });
logs.startLogExports({
logGroupName: '/aws/lambda/IncidentPlaybook',
logStreamNamePrefix: 'incident-playbook-stream',
}).promise()
.then((data) => {
console.log(`Started CloudWatch Logs export for Lambda: ${data.LogGroupName}`);
})
.catch((err) => {
console.error('Error starting CloudWatch Logs export:', err);
});

// Start the Express server
app.listen(3000, () => {
console.log('Express server started on port 3000');
});
