import * as child_process from 'child_process';
import { promisify } from 'util';

const exec = promisify(child_process.exec);

async function runPlaybook() {
const playbookPath = './incident-response-playbook.yml';
const ansiblePath = '/path/to/ansible'; // Adjust this path according to your Ansible installation location
const command = `${ansiblePath}-playbook ${playbookPath}`;

try {
await exec(command);
console.log('Playbook executed successfully.');
} catch (error) {
console.error(`Error executing playbook: ${error}`);
}
}

runPlaybook();
