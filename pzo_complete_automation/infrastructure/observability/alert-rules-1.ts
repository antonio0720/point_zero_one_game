import * as core from '@kubernetes/client-node';
import * as express from 'express';
import { AlertmanagerConfig } from 'prom-client/build/esm/config';
import lokiClient from 'lokijs';

const api = express();
const k8s = new core.KubeConfig();
k8s.loadFromDefault();
const k8sApi = core.KubernetesObject.buildApi(k8s);

// Prometheus Alertmanager configuration
const alertManagerConfig: AlertmanagerConfig = {
global: {
resolve_timeout: '5m',
},
route: [
{
match: [
{
alertname: 'MyAlertName',
},
],
receiver: 'my-alertmanager-receiver',
},
],
};

// Loki client configuration
const loki = new lokijs('loki.db');
loki.addCollection('alerts');

api.get('/api/alerts', (req, res) => {
res.json(loki.data('alerts'));
});

api.post('/api/alerts', (req, res) => {
const alert = req.body;
loki.collection('alerts').insert(alert);
// Here you can call your custom function to send the alert to Loki and trigger notifications
});

// Deploy Alertmanager with the specified configuration
const alertmanagerDeployment = new core.apps_v1_Deployment();
alertmanagerDeployment.metadata = new core.Metadata();
alertmanagerDeployment.metadata.name = 'alertmanager';

alertmanagerDeployment.spec = {
replicas: 1,
selector: {
matchLabels: {
app: 'alertmanager',
},
},
template: new core.v1_PodTemplateSpec(),
template.metadata = new core.Metadata();
template.metadata.labels = {
app: 'alertmanager',
};

// Set environment variables for Alertmanager configuration and Loki URL
template.spec = new core.v1_PodSpec();
template.spec.containers = [
{
name: 'alertmanager',
image: 'quay.io/prometheus/alertmanager:v0.21.0',
env: [
{
name: 'ALERTMANAGER_CONFIG',
value: JSON.stringify(alertManagerConfig),
},
{
name: 'LOKI_URL',
value: 'http://loki-server:3100', // Replace with your Loki server's URL
},
],
},
];
};

// Deploy the API to a Kubernetes service
const apiService = new core.core_v1_Service();
apiService.metadata = new core.Metadata();
apiService.metadata.name = 'observability-api';
apiService.spec = {
selector: {
app: 'api',
},
ports: [
{
port: 80,
targetPort: 8080,
name: 'http',
protocol: 'TCP',
},
],
};

// Create a deployment for the API
const apiDeployment = new core.apps_v1_Deployment();
apiDeployment.metadata = new core.Metadata();
apiDeployment.metadata.name = 'observability-api';

apiDeployment.spec = {
replicas: 1,
selector: {
matchLabels: {
app: 'api',
},
},
template: new core.v1_PodTemplateSpec(),
template.metadata = new core.Metadata();
template.metadata.labels = {
app: 'api',
};

// Set the container image and port for the API
template.spec = new core.v1_PodSpec();
template.spec.containers = [
{
name: 'api',
image: 'my-observability-api-image:latest',
ports: [
{
containerPort: 8080,
},
],
},
];
};

// Deploy Alertmanager and the API to Kubernetes
k8sApi.apps_v1.deployments.create(apiDeployment);
k8sApi.apps_v1.deployments.create(alertmanagerDeployment);
k8sApi.core_v1.services.create(apiService);
