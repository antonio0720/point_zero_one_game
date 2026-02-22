import { Client as GcmClient } from '@elastacloud/chaos-monkey';
import * as k8s from '@kubernetes/client-node';

const config = new k8s.KubeconfigLoad();
const k8sApi = k8s.KubeConfig.buildObject(config);

const gcm = new GcmClient({ kubeconfig: k8sApi });

async function runFailureInjection() {
const namespace = 'default'; // replace with your desired namespace
await gcm.init();

const podSelector = {
matchLabels: {
app: 'your-app', // replace with your application's label
},
};

await gcm.run({
actions: [
{
action: 'pod-terminate',
params: {
podSelector,
maxPods: 10, // number of pods to terminate (adjust as needed)
},
},
{
action: 'network-partition',
params: {
selector: podSelector,
maxPods: 5, // number of pods to partition (adjust as needed)
},
},
],
namespace,
concurrency: 30, // number of actions to run simultaneously (adjust as needed)
});
}

runFailureInjection().catch(console.error);
