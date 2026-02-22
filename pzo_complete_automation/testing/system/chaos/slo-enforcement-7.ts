import { appInsights } from './app-insights';
import { KubernetesClient } from '@kubernetes/client-node';
import * as yaml from 'js-yaml';
import axios, { AxiosResponse } from 'axios';
import { Metric, ResourceMetric, MetricValueType } from '@azure/monitor-common';
import { MetricsClient } from '@azure/arm-insights';

const k8s = new KubernetesClient({ config: createKubeConfig() });
const metricsClient = new MetricsClient(createInsightsCredentials());

interface ChaosTest {
name: string;
namespace: string;
deployment: string;
podTemplateHash?: string;
targetUtilizationPercentage: number;
}

function createKubeConfig(): any {
// Load the kubeconfig file, usually located in ~/.kube/config or wherever you set it.
const kubeconfig = yaml.load(require('fs').readFileSync('./kubeconfig', 'utf8'));
return kubeconfig;
}

function createInsightsCredentials(): any {
// Set your subscription ID, client ID, secret, tenant ID here or load from environment variables.
const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID || 'your-subscription-id';
const clientId = process.env.AAD_CLIENT_ID || 'your-aad-client-id';
const secret = process.env.AAD_CLIENT_SECRET || 'your-aad-client-secret';
const tenantId = process.env.AAD_TENANT_ID || 'your-aad-tenant-id';

return {
clientId,
secret,
tenant: tenantId,
};
}

async function getPods(namespace: string): Promise<string[]> {
const response = await k8s.api.v1.listNamespacedPod.apply(k8s.apis.core.v1, { namespace });
return response.body.items.map((pod) => pod.metadata?.name || '');
}

async function getDeployments(namespace: string): Promise<string[]> {
const response = await k8s.api.apps.v1.listNamespacedDeployment.apply(k8s.apis.apps, { namespace });
return response.body.items.map((deployment) => deployment.metadata?.name || '');
}

async function createPodDisruptionBudget(podTemplateHash: string, targetUtilizationPercentage: number): Promise<void> {
const pdb = {
apiVersion: 'policy/v1beta1',
kind: 'PodDisruptionBudget',
metadata: {
name: `pdb-${podTemplateHash}`,
},
spec: {
selector: {
matchLabels: {
podTemplateHash,
},
},
minAvailable: targetUtilizationPercentage,
maxUnavailable: targetUtilizationPercentage - 1,
rolloutPolicy: 'RollingUpdate',
},
};

await k8s.api.policy.v1beta1.createNamespaced(pdb, 'disruptionbudgets');
}

async function deletePodDisruptionBudget(podTemplateHash: string): Promise<void> {
const response = await k8s.api.policy.v1beta1.deleteNamespaced(
`pdb-${podTemplateHash}`,
'disruptionbudgets',
{ namespace: 'default' }
);
await response.data;
}

async function createLoadTest(): Promise<void> {
const namespace = 'your-namespace';
const chaosTests: ChaosTest[] = [
{
name: 'load-test-1',
namespace,
deployment: 'your-deployment',
targetUtilizationPercentage: 80,
},
// Add more tests as needed.
];

for (const test of chaosTests) {
const pods = await getPods(test.namespace);
if (!pods.includes(test.deployment)) {
throw new Error(`Deployment "${test.deployment}" not found in namespace "${test.namespace}".`);
}

test.podTemplateHash = (await k8s.api.apps.v1.readNamespacedPod(test.deployment, test.namespace)).body.metadata?.ownerReferences?.[0]?.uid || '';

if (test.podTemplateHash) {
await createPodDisruptionBudget(test.podTemplateHash, test.targetUtilizationPercentage);

const applicationInsightsClient = appInsights.defaultClient;
applicationInsightsClient.context.tags['environment'] = 'testing';

// Simulate load by sending HTTP requests to the deployment's service.
const baseUrl = `http://${test.deployment}.${test.namespace}.svc.cluster.local`;
for (let i = 0; i < test.targetUtilizationPercentage; i++) {
await axios.get(baseUrl);
}

// Wait for some time to ensure the pods are under load.
await new Promise((resolve) => setTimeout(resolve, 60 * 1000));

const metricName = `RequestCount`;
const resourceMetric: ResourceMetric = {
resourceUri: `Subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}/resourceGroups/your-resource-group/providers/Microsoft.Web/sites/your-deployment`,
name: metricName,
};

const metricsResponse = await metricsClient.list(metricName, resourceMetric);
const lastMetric: Metric | undefined = metricsResponse.value?.[0];

if (lastMetric && lastMetric.value[0].value > test.targetUtilizationPercentage) {
console.log(`Successfully reached ${test.targetUtilizationPercentage}% utilization for deployment "${test.deployment}"`);
} else {
throw new Error('Failed to reach the target utilization percentage.');
}
} else {
console.warn(`Unable to find podTemplateHash for deployment "${test.deployment}" in namespace "${test.namespace}".`);
}
}
}

async function cleanUp(): Promise<void> {
const chaosTests: ChaosTest[] = [
// Load the same tests as in createLoadTest().
];

for (const test of chaosTests) {
if (test.podTemplateHash) {
await deletePodDisruptionBudget(test.podTemplateHash);
}
}
}

(async () => {
try {
await createLoadTest();
await new Promise((resolve) => setTimeout(resolve, 60 * 60 * 1000)); // Wait for an hour to simulate stress test.
console.log('Stress testing completed.');
await cleanUp();
} catch (error) {
console.error(error);
process.exitCode = 1;
}
})();
