import { ChaosMonkey } from 'chaos-monkey';
import { K8sClient, WatchEventType } from '@kubernetes/client-node';
import * as fs from 'fs';
import * as path from 'path';

const kubeconfig = JSON.parse(fs.readFileSync(path.join(__dirname, '.kube', 'config'), 'utf8'));
const k8sClient = new K8sClient({ config: kubeconfig });
const chaosMonkey = new ChaosMonkey({ kubernetes: k8sClient });

async function run() {
const podNames: string[] = [];
await chaosMonkey.watchNamespace('default', async (event) => {
if (event.type === WatchEventType.ADDED && event.object instanceof KubernetesPod) {
podNames.push(event.object.metadata?.name);
}
});

const instances = 3;
for (let i = 0; i < instances; i++) {
chaosMonkey.terminatePod({ namespace: 'default', podName: podNames[i % podNames.length] });
}
}

run().catch((err) => console.error(err));
