import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as promClient from '@prometheus/client';
import * as alertsApi from '@grafana/alerting-api';
import { KubeConfig, config, CoreV1Api, AppsV1Api } from '@kubernetes/client-node';

// Prometheus client metrics
const gauge = new promClient.Gauge({ name: 'example_gauge' });
const counter = new promClient.Counter({ name: 'example_counter' });

// Grafana Alerting API configuration
const grafanaConfig = {
url: 'http://grafana-server/api/alerts', // Grafana Alerting API URL
basicAuthUsername: 'username', // Grafana username for authentication
basicAuthPassword: 'password' // Grafana password for authentication
};

// Kubernetes configuration and API instances
const kubeConfig: KubeConfig = new KubeConfig();
kubeConfig.loadFromDefault();
const coreApi = new CoreV1Api(kubeConfig.getCurrentUser());
const appsApi = new AppsV1Api(kubeConfig.getCurrentUser());

// Express server setup
const app = express();
app.use(bodyParser.json());

// Prometheus metrics endpoint
app.get('/metrics', (req, res) => {
res.set('Content-Type', promClient.register.contentType);
res.send(promClient.register.metrics());
});

// Kubernetes service discovery and label selector for pods to monitor
const namespace = 'default'; // Target namespace for service discovery
const serviceLabel = 'app'; // Label key for target service/pod
const selectorValue = 'example-service'; // Label value for target service/pod

// Function to get the list of pods matching the given label selector in a specific namespace
async function getPodsByLabel(labelName, labelValue) {
const podList = await coreApi.listNamespacedPod(namespace);
return podList.items.filter((pod: any) => pod.metadata.labels[labelName] === labelValue);
}

// Function to get the Prometheus endpoint URL of a specific pod based on its name and namespace
function getPrometheusEndpointUrl(podName, namespace) {
return `http://${podName}:9090`;
}

// Function to fetch alert rules from Grafana Alerting API and update them if necessary
async function checkAndUpdateRules() {
const pods = await getPodsByLabel(serviceLabel, selectorValue);
for (const pod of pods) {
const prometheusUrl = getPrometheusEndpointUrl(pod.metadata.name, namespace);
const ruleExists = await checkRuleExists(grafanaConfig, prometheusUrl, 'ExampleAlertRule');

if (!ruleExists) {
console.log('Creating new alert rule:', prometheusUrl);
await createRule(grafanaConfig, prometheusUrl, 'ExampleAlertRule');
} else {
console.log('Updating existing alert rule:', prometheusUrl);
await updateRule(grafanaConfig, prometheusUrl, 'ExampleAlertRule');
}
}
}

// Function to check if a specific rule exists in Grafana Alerting API
async function checkRuleExists(config: any, url: string, ruleName: string) {
const response = await fetch(`${url}/rules`, { headers: config.headers });
const rules = await response.json();
return rules.findIndex((rule: any) => rule.name === ruleName) !== -1;
}

// Function to create a new alert rule in Grafana Alerting API
async function createRule(config: any, url: string, ruleName: string) {
const response = await fetch(`${url}/rules`, {
method: 'POST',
headers: config.headers,
body: JSON.stringify({
name: ruleName,
rules: [
// Alert rule definition goes here
// Example: { selector: '...', expr: 'example_gauge > 10' }
],
silencings: [],
for: 1 * 60 * 1000, // Duration in milliseconds for the initial evaluation of the rule (1 minute)
repeat: '1h' // Evaluation interval for the alert rule
})
});

if (!response.ok) {
throw new Error(`Failed to create alert rule: ${ruleName}`);
}
}

// Function to update an existing alert rule in Grafana Alerting API
async function updateRule(config: any, url: string, ruleName: string) {
const response = await fetch(`${url}/rules/${ruleName}`, {
method: 'PUT',
headers: config.headers,
body: JSON.stringify({
// Update the rules and other properties as needed here
// Example: rules: [ ... ], for: <new_duration_in_milliseconds>
})
});

if (!response.ok) {
throw new Error(`Failed to update alert rule: ${ruleName}`);
}
}

// Schedule checkAndUpdateRules function to run at startup and every hour
checkAndUpdateRules();
setInterval(checkAndUpdateRules, 3600000); // Every 1 hour (3600000 milliseconds)

app.listen(3000);
