import { ChaosmeshClient } from '@chaostoolkit/chaos-k8s';
import { SloEnforcement } from '@chaostoolkit/kube-controller-runtime';

const chaos = new ChaosmeshClient();
const sloEnforcement = new SloEnforcement(chaos);

// Define the service and namespace where you want to enforce the SLO
const serviceName = 'your-service';
const namespace = 'your-namespace';

// Define the SLOs that need to be enforced
const sloEnforcements: SloEnforcement.SloEnforcementRule[] = [
{
apiVersion: 'chaos-mesh.org/v1',
kind: 'SloEnforcement',
metadata: {
name: `${serviceName}-slo`,
},
spec: {
selector: {
matchLabels: {
app: serviceName,
},
},
podTemplate: {
spec: {
containers: [
{
name: 'enforcer',
image: 'chaos-mesh/kube-controller-runtime@v0.6.2',
command: ['slo-enforce'],
args: [
'--service',
serviceName,
'--namespace',
namespace,
// Define your SLOs here (e.g., latency or error rate)
'--latency-max=100ms',
],
},
],
},
},
},
},
];

// Create the SLO enforcement rules
await sloEnforcement.create(sloEnforcements);

console.log('SLO Enforcement Rules created');
