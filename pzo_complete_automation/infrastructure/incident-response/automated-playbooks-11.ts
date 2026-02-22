import * as ini from 'ini';
import * as fs from 'fs';
import { exec } from 'child_process';

const config = ini.parse(fs.readFileSync('playbooks.ini', 'utf8'));

function runPlaybook(playbookName: string) {
const ansiblePlaybookPath = config.default.ansible_path + '/' + playbookName;
exec(`ansible-playbook ${ansiblePlaybookPath}`, (error, stdout, stderr) => {
if (error) {
console.error(`exec error: ${error}`);
return;
}

console.log(stdout);
console.error(`stderr: ${stderr}`);
});
}

// Example usage: Run the incident response playbook for a network isolation scenario
runPlaybook('incident_response_network_isolation.yml');
