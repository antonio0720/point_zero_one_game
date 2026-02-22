import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const promQL = `...your PromQL query here...`;
const grafanaDashboard = '...your Grafana dashboard JSON here...';
const targetGroup = 'your-alertmanager-target-group';

function exec(command: string, options?: any): Promise<void> {
return new Promise((resolve, reject) => {
const spawnedProcess = child_process.spawnSync(command, options);
if (spawnedProcess.status !== 0) {
console.error(`cmd '${command}' failed:`);
console.error(spawnedProcess.stderr.toString());
reject();
} else {
resolve();
}
});
}

function getPrometheusData() {
return new Promise((resolve, reject) => {
const promQLQuery = `query --v=$(echo $ALERTNAME) -format json`;
exec('promql', { stdio: 'pipe', input: fs.readFileSync(path.join(__dirname, 'promql_query.template')) }, (error, stdout, stderr) => {
if (error) {
reject(error);
} else {
const promData = JSON.parse(stdout.toString());
resolve(promData);
}
});
});
}

async function displayGrafanaDashboard() {
await exec('grafana-cli', ['dashboard iframe', grafanaDashboard]);
}

function main() {
// Listen for Alertmanager webhooks on the specified target group
const alertName = process.env.ALERTNAME;
if (!alertName) {
console.error('Missing ALERTNAME environment variable.');
process.exit(1);
}

exec(`curl -X POST https://your-alertmanager-url/api/v2/alerts -H 'Content-Type: application/json' -d '{"status": "resolved", "comment": "Resolved by automation"}'`, (error) => {
if (error) {
console.error(`Failed to send Alertmanager webhook:`);
console.error(error);
process.exit(1);
}
});

getPrometheusData().then((promData) => {
// Visualize the data in Grafana
displayGrafanaDashboard();
}).catch((err) => {
console.error(`Error retrieving Prometheus data:`);
console.error(err);
});
}

main();
