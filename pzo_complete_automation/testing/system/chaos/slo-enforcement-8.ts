import * as chaostest from 'chaostest';
import * as k8s from '@kubernetes/client-node';
import { PodApi } from '@kubernetes/client-node';

const client = new k8s.KubeConfigLoadFromDefault().makeApiClient(PodApi);

const namespace = 'your-namespace';
const podName = 'your-pod-name';

// Define the metrics to monitor for SLO enforcement
const metricNames: string[] = ['http_requests_total', 'http_request_duration_seconds'];

// Define the SLOs (Service Level Objectives)
const slos = [
{
metricName: metricNames[0],
targetValue: 100, // number of requests per second
errorBudget: 20, // percentage of total requests allowed to fail
},
{
metricName: metricNames[1],
targetValue: 500, // milliseconds request duration
errorBudget: 30, // percentage of total requests allowed to exceed the limit
},
];

// Define the chaos experiments
const loadTest = chaostest.loadTest({
duration: '1m',
pod: { name: podName, namespace },
containerPort: 80,
concurrency: 5,
});

const stressTest = chaostest.stressTest({
duration: '1m',
pod: { name: podName, namespace },
containerPort: 80,
request: { method: 'GET' },
});

const chaosTest = chaostest.chaosTest({
duration: '1m',
pod: { name: podName, namespace },
containerPort: 80,
chaosAction: 'kill',
chaosPercentage: 5,
});

// Run the tests and enforce SLOs using the provided SLOs array
async function runTestsWithSloEnforcement() {
const { metrics } = await chaostest.run({
client,
namespaces: [namespace],
tests: [loadTest, stressTest, chaosTest],
sloEnforcement: {
metrics,
slos,
onViolation: (slo, violation) => {
console.error(
`SLO violation detected for metric '${slo.metricName}':\n  Target: ${slo.targetValue}\n  Actual: ${violation.actualValue}\n  Error budget remaining: ${violation.remainingBudget}%`
);
},
},
});
}

runTestsWithSloEnforcement();
