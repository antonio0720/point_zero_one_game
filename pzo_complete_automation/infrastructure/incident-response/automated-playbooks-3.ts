import { execSync } from 'child_process';
import * as k8s from '@kubernetes/client-node';
import { Logger } from 'winston';

export async function playbook3(logger: Logger, config) {
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const apiInstance = kc.makeApiClient(k8s.Apps_v1Api);

try {
const namespace = 'default';
const podList = await apiInstance.listNamespacedPod(namespace);

for (const pod of podList.body.items) {
// Check for specific conditions or labels to identify affected pods
if (pod.status.conditions?.some((c) => c.type === 'CrashLoopBackOff')) {
logger.info(`Detected CrashLoopBackOff in Pod: ${pod.metadata.name}`);

const cmd = `kubectl rollout undo deployment/${pod.metadata.ownerReferences[0].name}`;
execSync(cmd, { stdio: 'inherit' });
}
}
} catch (error) {
logger.error(`Error executing playbook3: ${error}`);
}
}
