import * as argo from '@argoproj/argo';
import * as k8s from '@kubernetes/client-node';
import { KSMClient } from 'kubestatemetrics2';
import { ChaosMeshClient } from 'chaos-mesh';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = k8s.kubernetes.KubeApis.createForConfig(kc);

const workflow = new argo.Application({ api: k8sApi });
const projectName = 'my-project';
const chartName = 'my-chart';

// Load test step with JMeter
const loadTestStep = workflow.steps.newTemplatedParallel('load-test', (t) => {
t.withNewContainer('jmeter', () => {
t.container.image = 'jmeter:5.3';
t.container.command = ['sh', '-c', 'jmeter -n -t load_test.jmx -l jmeter.log'];
});
});

// Stress test step with Helm
const stressTestStep = workflow.steps.newTemplated('stress-test', (t) => {
t.withNewContainer('helm', () => {
t.container.image = 'helm/helm:v3.8.0';
t.container.command = [
'helm',
'upgrade',
`${chartName}`,
'-f',
'stress-test-values.yaml',
];
});
});

// Chaos test step with Chaos-Mesh
const chaosTestStep = workflow.steps.newTemplated('chaos-test', (t) => {
const cmClient = new ChaosMeshClient({ kubeconfig: kc.raw });
t.withNewContainer('chaos-mesh', () => {
t.container.image = 'chaos-mesh/chaos-mesh:v1.7.0';
t.container.command = ['cm', 'launch', '--api', `${cmClient.getApiUrl()}`];
});
});

// SLO enforcement step with KubeStateMetrics
const sloEnforcementStep = workflow.steps.newTemplated('slo-enforcement', (t) => {
const ksmClient = new KSMClient({ kubeconfig: kc.raw });
t.withNewContainer('ksm', () => {
t.container.image = 'quay.io/kubestatemetrics/ksm-operator:v2.4.0';
t.container.command = [
'ksm',
'alerts',
'add',
'-r',
`${ksmClient.getApiUrl()}/apis/monitoring.coreos.com/v1/namespaces/default/alerts`,
'--file',
'slo-enforcement.yaml',
];
});
});

// Define the workflow
const steps = [loadTestStep, stressTestStep, chaosTestStep, sloEnforcementStep];
workflow
.withNewTemplate('slo-enforcement-3', (t) => {
t.metadata.name = 'slo-enforcement-3';
t.metadata.labels = { app: projectName };
t.steps = steps;
})
.toYaml();
