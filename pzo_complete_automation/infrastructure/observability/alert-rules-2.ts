import { KubeConfig, RawConfig } from '@kubernetes/client-node';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import promClient from 'prom-client';

const app = express();
app.use(bodyParser.json());

// Initialize Prometheus client metrics
const gauge = new promClient.Gauge({ name: 'example_gauge' });

// Function to create the Kubernetes client
async function createKubeClient() {
const config: RawConfig = {
user: '', // path to the kubeconfig user
cluster: '', // path to the kubeconfig cluster
server: '', // Kubernetes API server address
certificateAuthorityData: '', // path to the CA data, or base64 encoded CA data
};

const kc = new KubeConfig.fromRawConfig(config);
return kc.makeApiClient(prometheusOperators.v1api.KubePrometheusAPIBindingAPIService);
}

// Function to create an alert rule
async function createAlertRule(client: any, namespace: string) {
const api = client.apis['prometheus.io/v1beta2'];
const rule = new api.v1beta2.AlertRule();

rule.metadata = new api.v1.ObjectMeta();
rule.metadata.name = 'example-alert';
rule.spec = new api.v1beta2.AlertRuleSpec();
rule.spec.alertns = namespace;
rule.spec.rules = [
{
alert: 'ExampleAlert',
expr: `example_gauge > 5`, // replace this with your own condition
for: ['30s'],
annotations: {
description: 'Description of the alert',
severity: 'critical' // 'critical', 'warning' or 'info'
}
},
];

return await api.alertRules(namespace).create(rule);
}

app.post('/api/alerts', async (req, res) => {
try {
const client = await createKubeClient();
const namespace = req.body.namespace;
await createAlertRule(client, namespace);
res.status(201).json({ message: 'Alert rule created' });
} catch (err) {
console.error(err);
res.status(500).json({ error: err.message });
}
});

app.listen(3000, () => console.log('Server started on port 3000'));
