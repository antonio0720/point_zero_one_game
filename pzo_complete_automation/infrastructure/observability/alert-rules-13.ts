import { MonitoringClient } from '@google-cloud/monitoring';
import { Metric, Duration, TimeInterval } from '@google-cloud/monitoring/build/src/v3';

const monitoring = new MonitoringClient();

// Replace these variables with your own project ID and metric specifics
const projectId = 'your_project_id';
const metricName = 'compute.googleapis.com/instance/cpu/utilization';
const alertPolicyDisplayName = 'High CPU Utilization Alert';
const thresholdValue = 0.8; // Adjust the value as needed (0-1)
const comparisonType = 'COMPARISON_TYPE_GREATER_THAN';
const notificationChannels = ['your_notification_channel_id'];

async function createAlertPolicy() {
const metric = await monitoring.getMetric(projectId, Metric.metricPathFromParts('compute.googleapis.com', 'instance', 'cpu', 'utilization'));

const condition = {
displayName: `${alertPolicyDisplayName} Condition`,
comparison: {
operator: comparisonType,
thresholdValueMetric: {
metric,
},
thresholdValue: {
value: thresholdValue,
unit: metric.unit,
},
},
};

const notification = {
type: 'email',
name: 'Email Notification',
value: notificationChannels,
};

const document = {
displayName: alertPolicyDisplayName,
conditions: [condition],
documentation: 'This policy triggers an alert when CPU utilization exceeds the threshold.',
creationTs: new Date(),
editLinks: [],
name: `projects/${projectId}/notifications/cpu-utilization-alert`,
};

await monitoring.createNotificationChannel(notification);
const [alert] = await monitoring.createAlertPolicy(document);
console.log(`Created alert policy: ${alert.name}`);
}

createAlertPolicy().catch(console.error);
