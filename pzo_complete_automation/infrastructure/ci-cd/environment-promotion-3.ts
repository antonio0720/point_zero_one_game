import * as k8s from '@kubernetes/client-node';
import * as helms from '@kubernetes/helm-client';
import * as fs from 'fs';
import * as path from 'path';

const config = new k8s.KubeConfig();
config.loadFromDefault();

const k8sApi = k8s.defaultClient;
const helmApi = helms.newApi(k8sApi);

function getHelmRelease(namespace: string, name: string) {
return new Promise((resolve, reject) => {
helmApi.getList({ namespace }, (error, list) => {
if (error) return reject(error);

const release = list.items.find(
(r: any) => r.metadata.name === name && r.status.chart && r.spec.releaseName
);

if (!release) return reject(new Error(`Helm Release ${name} not found`));

resolve(release);
});
});
}

function promoteEnvironment(currentNamespace: string, targetNamespace: string, releaseName: string) {
return new Promise(async (resolve, reject) => {
try {
const currentRelease = await getHelmRelease(currentNamespace, releaseName);
const targetRelease = JSON.parse(JSON.stringify(currentRelease));

// Set the target namespace in the release
targetRelease.metadata.namespace = targetNamespace;

// Save the new release configuration to a file
const helmFile = path.join(__dirname, 'temp-release.yaml');
fs.writeFileSync(helmFile, JSON.stringify(targetRelease));

// Install the updated release in the target namespace
helmApi.upgrade({
values: [],
yaml: fs.readFileSync(helmFile).toString(),
replace: true,
}, (error) => {
if (error) return reject(error);
resolve();
});
} catch (err) {
reject(err);
}
});
}

promoteEnvironment('staging', 'production', 'my-app')
.then(() => console.log('Promoted environment successfully'))
.catch((error) => console.error(`Error promoting environment: ${error}`));
