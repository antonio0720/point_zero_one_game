import * as promClient from 'prom-client';
import { Client } from '@elastic/apm-node';
import { AlertManagerConfig } from 'alertmanager-client';
import * as amQl from 'alertmanager-ql';

// Create Prometheus client to scrape metrics
const cpuUsage = new promClient.Gauge({ name: 'cpu_usage_5m', help: 'CPU usage for the last 5 minutes' });
const memoryUsage = new promClient.Gauge({ name: 'memory_usage_5m', help: 'Memory usage for the last 5 minutes' });

// Set up APM client to trace alert rule execution
const apm = new Client({ serviceName: 'alert-rule-12' });
apm.start();

// Create alert rule configuration
const amConfig: AlertManagerConfig = {
global_config: {},
route: [
{
match: [],
receiver: 'my-email', // Replace with your email receiver or webhook URL
},
],
groups: [
{
name: 'HighCPUMemoryUsage',
rules: [
{
alert: 'High CPU and Memory Usage',
expr: amQl`container_cpu_usage_5m{namespace="default", container!=""} > 80`, // Adjust threshold as needed
for: '30s',
labels: {},
},
],
},
],
};

// Create Prometheus client session and scrape metrics
const client = new promClient.Client();
client.on('err', console.error);
await client.start();

setInterval(async () => {
const cpuUsageGauge = await client.getSingleGauge({ name: 'cpu_usage_5m' });
const memoryUsageGauge = await client.getSingleGauge({ name: 'memory_usage_5m' });

cpuUsage.set(parseFloat((cpuUsageGauge.value / cpuUsageGauge.max).toFixed(2)));
memoryUsage.set(parseFloat((memoryUsageGauge.value / memoryUsageGauge.max).toFixed(2)));

apm.currentSpan?.addEvent({ name: 'ScrapedMetrics', data: { cpu_usage: cpuUsage.get(), memory_usage: memoryUsage.get() } });
}, 60000); // Update metrics every minute

// Periodically send alert rules to Alertmanager
const alertRulesInterval = setInterval(async () => {
const amResponse = await fetch('/api/v2/alerts', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(amConfig),
});

if (!amResponse.ok) {
console.error('Failed to send alert rules:', amResponse.status);
}
}, 60 * 5 * 1000); // Send alert rules every 5 minutes
