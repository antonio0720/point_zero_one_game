import * as express from 'express';
import * as promClient from 'prom-client';
import * as alerts from '@grafana/alerting-api';
import { AlertManagerClient } from 'alertmanager-client';

// Prometheus client metrics
const cpuUtilization = new promClient.Gauge({ name: 'cpu_utilization', help: 'CPU utilization' });
const memoryUsage = new promClient.Gauge({ name: 'memory_usage_percent', help: 'Memory usage percent' });

// Grafana Alerting API client
const apiClient = alerts.ApiClient.instance;
apiClient.defaults.basePath = process.env.GRAFANA_API_URL;
const auth = new alerts.BasicAuth({ username: process.env.GRAFANA_USERNAME, password: process.env.GRAFANA_PASSWORD });
apiClient.authentications['Basic Authentication'].username.password = auth;

// AlertManager client
const amClient = new AlertManagerClient(process.env.ALERTMANAGER_URL);

app.get('/metrics', async (req, res) => {
// Fetch metrics from Prometheus
// ...

// Expose the fetched metrics to Grafana
res.set('Content-Type', promClient.register.contentType);
res.write(promClient.register.metrics());
res.end();
});

app.post('/api/alerts', async (req, res) => {
const alertRules = req.body as alerts.AlertRule[];

// Send the new rules to AlertManager
for (const rule of alertRules) {
try {
await amClient.putRule(rule);
console.log(`Successfully created alert rule: ${JSON.stringify(rule)}`);
} catch (err) {
console.error(`Failed to create alert rule: ${err}`);
res.status(500).send({ error: err.message });
return;
}
}

// Save the new rules in Grafana Alerting API
try {
const response = await apiClient.postAlertRules('', alertRules, undefined);
console.log(`Successfully saved ${alertRules.length} alert rules`);
res.send(response.data);
} catch (err) {
console.error(`Failed to save alert rules: ${err}`);
res.status(500).send({ error: err.message });
}
});
