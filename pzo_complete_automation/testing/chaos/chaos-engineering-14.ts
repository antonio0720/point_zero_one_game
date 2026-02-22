import { Chaos, Failure, ChaosInjector, ChaosSource, KubeAPISource } from 'chaos-k8s';

const chaos = new Chaos({
metadata: {
name: 'my-chaos-experiment',
},
});

// Create a pod failure source
const podFailureSource = new ChaosSource('PodFailure')
.podDisruptionBudget({
selector: {
matchLabels: {
app: 'my-app',
},
},
maxUnavailable: 1,
});

// Create a chaos injector with the pod failure source
const injector = new ChaosInjector(podFailureSource);

// Schedule the chaos experiment to run every hour
chaos.onSchedule({ periodSeconds: 3600 }).do(injector.inject());

// Initialize the chaos controller
async function main() {
await chaos.init();
}

main().catch((err) => console.error('Failed to initialize Chaos Controller', err));
