import * as alerts from '@google-cloud/pubsub';
import * as dotenv from 'dotenv';
import { Duration } from '@google-cloud/common';
import { SlackClient, Webclient } from '@slack/web-client';
import { AppDataSource } from './data-source';
import { MetricRepository } from './metric.repository';

// Load environment variables
dotenv.config();

const pubsub = new alerts.v1.Publisher({
projectId: process.env.PROJECT_ID,
keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});
const slack = new SlackClient(process.env.SLACK_BOT_TOKEN);
const dataSource = AppDataSource.createConnection();
const metricRepo = new MetricRepository(dataSource);

// Custom incident playbook function
async function handleIncident(incident: any) {
console.log(`New incident detected: ${incident.name}`);

// Fetch relevant metrics for this incident
const metrics = await metricRepo.getMetricsForIncident(incident.name);

// Send initial Slack notification with incident details and metrics
sendSlackNotification(incident, metrics);

// Monitor the incident and update the Slack notification every 5 minutes
const intervalId = setInterval(async () => {
metrics.forEach((metric) => {
if (metric.currentValue > metric.criticalThreshold) {
console.log(`Critical threshold exceeded for ${metric.name}: ${metric.currentValue}`);
sendSlackNotificationUpdate(incident, metric);
}
});
}, Duration.fromMillis(5 * 60 * 1000));

// Clear the interval when the incident is closed
incident.on('closed', () => {
console.log(`Incident "${incident.name}" has been closed`);
clearInterval(intervalId);
});
}

// Send initial Slack notification with incident details and metrics
function sendSlackNotification(incident: any, metrics: any[]) {
const message = `New incident detected: ${incident.name}\nMetrics:\n${metrics
.map((metric) => `${metric.name}: ${metric.currentValue}`)
.join('\n')}`;

slack.chat.postMessage({ channel: process.env.SLACK_CHANNEL, text: message });
}

// Send a Slack update notification with an updated incident status and metric value
function sendSlackNotificationUpdate(incident: any, metric: any) {
const message = `Incident "${incident.name}" - ${metric.name}: ${metric.currentValue}`;

slack.chat.postMessage({ channel: process.env.SLACK_CHANNEL, text: message });
}

// Subscribe to Google Cloud incident notifications using Pub/Sub
const subscription = new alerts.v1.Subscription({
name: `projects/${process.env.PROJECT_ID}/subscriptions/sre-incident`,
topic: `projects/${process.env.PROJECT_ID}/topics/cloud-sre-notifications`,
});

subscription.on('message', (messageResponse) => {
const message = messageResponse.data;
const incidentData = JSON.parse(message.data.toString());
handleIncident(incidentData);
messageResponse.ack();
});

subscription.subscribe();
