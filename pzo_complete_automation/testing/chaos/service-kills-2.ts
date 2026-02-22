import * as child_process from 'child_process';
import * as fs from 'fs';

const manifestPath = './manifest.yaml';
const deploymentName = 'your-deployment';
const chaosIntervalSeconds = 10;
const maxKills = 5;

// Load Kubernetes configuration
let kubeconfig: string;
try {
const configData = fs.readFileSync('.kube/config', 'utf8');
kubeconfig = JSON.parse(configData).users[0].clientCertificate + '\n' + JSON.parse(configData).users[0].clientKey + '\n' + JSON.parse(configData).clusters[0].certificateAuthority;
} catch (err) {
console.error('Error reading kubeconfig:', err);
process.exit(1);
}

// Create a manifest file if it doesn't exist
if (!fs.existsSync(manifestPath)) {
const manifestContent = `apiVersion: apps/v1
kind: Deployment
metadata:
name: ${deploymentName}
spec:
replicas: 5
selector:
matchLabels:
app: your-app
template:
metadata:
labels:
app: your-app
spec:
containers:
- name: your-container
image: your-image:latest`;
fs.writeFileSync(manifestPath, manifestContent);
}

// Function to kill a deployment
async function killDeployment() {
const args = ['delete', 'deployment', deploymentName];
const execOptions = {
cwd: process.cwd(),
env: { ...process.env, KUBECONFIG: kubeconfig },
input: undefined,
output: 'pipe',
errorOutput: 'pipe'
};
return new Promise((resolve, reject) => {
const killDeploymentProcess = child_process.spawn('kubectl', args, execOptions);
let killDeploymentOutput = '';

killDeploymentProcess.stdout.on('data', (data) => {
killDeploymentOutput += data;
});

killDeploymentProcess.stderr.on('data', (data) => {
console.error(`Kill Deployment error: ${data.toString()}`);
});

killDeploymentProcess.on('close', (code) => {
if (code !== 0) {
reject(new Error(`Failed to delete deployment with exit code ${code}: ${killDeploymentOutput}`));
} else {
resolve();
}
});
});
}

// Chaos testing loop
async function runChaosTest() {
let kills = 0;

while (kills < maxKills) {
try {
await killDeployment();
console.log(`Successfully killed deployment ${deploymentName}`);
kills++;
} catch (err) {
console.error(err);
}

setTimeout(async () => {
// Re-create the deleted deployment after a chaos interval
const args = ['apply', '-f', manifestPath];
const execOptions = {
cwd: process.cwd(),
env: { ...process.env, KUBECONFIG: kubeconfig },
input: undefined,
output: 'pipe',
errorOutput: 'pipe'
};

const createDeploymentProcess = child_process.spawn('kubectl', args, execOptions);
let createDeploymentOutput = '';

createDeploymentProcess.stdout.on('data', (data) => {
createDeploymentOutput += data;
});

createDeploymentProcess.stderr.on('data', (data) => {
console.error(`Create Deployment error: ${data.toString()}`);
});

createDeploymentProcess.on('close', (code) => {
if (code !== 0) {
console.error(`Failed to recreate deployment with exit code ${code}: ${createDeploymentOutput}`);
}
});
}, chaosIntervalSeconds * 1000);
}
}

runChaosTest();
