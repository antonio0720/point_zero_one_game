import { KubeConfig, AppsApi, CoreV1Api } from '@kubernetes/client-node';
import * as fs from 'fs';

const kubeconfig = new KubeConfig();
kubeconfig.loadFromDefault();

const appsApi = new AppsApi(kubeconfig.currentContext);
const coreV1Api = new CoreV1Api(kubeconfig.currentContext);

async function getPodNamesInNamespace(namespace: string): Promise<string[]> {
const listOptions = {
namespace,
limit: Number.MAX_VALUE,
};
let listResult;

do {
listResult = await coreV1Api.listNamespacedPod(listOptions);
listOptions.continue = listResult.body?.metadata?.continuationToken;
} while (listOptions.continue);

return listResult.body?.items.map((pod) => pod.metadata?.name) || [];
}

async function deleteRandomPod(namespace: string): Promise<void> {
const podNames = await getPodNamesInNamespace(namespace);
const randomIndex = Math.floor(Math.random() * podNames.length);
const podName = podNames[randomIndex];

await coreV1Api.deleteNamespacedPod(podName, namespace);
}

async function deleteRandomServices(namespace: string): Promise<void> {
const serviceList = await appsV1Api.listNamespacedService(namespace);
const services = serviceList.body?.items;

if (!services || services.length === 0) return;

for (let i = 0; i < 11 && i < services.length; ++i) {
await appsV1Api.deleteNamespacedService(services[i].metadata?.name, namespace);
}
}

async function main() {
const namespace = 'default'; // Change this to the desired namespace

try {
await deleteRandomServices(namespace);
console.log(`Deleted ${11} random services in namespace: ${namespace}`);
} catch (error) {
console.error('Error while deleting services:', error);
}
}

main();
