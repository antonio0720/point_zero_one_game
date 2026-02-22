import { Metric, AlertPolicy, AlertCondition, TimePeriod, Disparity, ComparisonOperator } from '@google-cloud/monitoring';
import { MonitoringClient } from '@google-cloud/monitoring/v3';

const projectId = 'your-project-id';
const metric = new Metric('your-metric', 'metrics.googleapis.com', 'instance');
const alertPolicyName = 'your-alert-policy-name';
const conditionName = 'high-resource-usage';

const monitoringClient = new MonitoringClient();

async function createAlertPolicy() {
const [project] = await monitoringClient.getProject(projectId);

if (!(await project)) {
throw new Error(`Project ${projectId} not found.`);
}

const alertPolicy = new AlertPolicy({
displayName: 'High Resource Usage',
documentation: 'This policy alerts when resource usage is too high.',
conditions: [
new AlertCondition({
displayName: conditionName,
conditionThreshold: {
duration: new TimePeriod({ seconds: 300 }),
value: 80, // Replace with the appropriate threshold for your metric
},
comparator: ComparisonOperator.GREATER_THAN,
metric: metric,
})
],
notificationChannels: [
{
type: 'email',
value: 'example@example.com', // Replace with the email address to be notified
}
],
});

await monitoringClient.createAlertPolicy(projectId, alertPolicyName, alertPolicy);
console.log(`Created Alert Policy ${alertPolicyName}`);
}

createAlertPolicy().catch(console.error);
