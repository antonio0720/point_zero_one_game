import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

interface Incident {
id: string;
description: string;
status: 'open' | 'in-progress' | 'closed';
}

class IncidentResponse {
incidents: Incident[];

constructor() {
this.incidents = [];
}

createIncident(id: string, description: string): void {
const incident: Incident = { id, description, status: 'open' };
this.incidents.push(incident);
}

updateIncidentStatus(id: string, status: 'in-progress' | 'closed'): void {
const incident = this.incidents.find((i) => i.id === id);
if (incident) {
incident.status = status;
} else {
console.error(`No incident found with ID: ${id}`);
}
}

executePlaybook(playbook: string): void {
const playbookPath = path.join(__dirname, 'playbooks', `${playbook}.sh`);
if (fs.existsSync(playbookPath)) {
child_process.execFile(process.execPath, ['-c', `require('child_process').spawn('sh', ['${playbookPath}'])`]);
} else {
console.error(`Playbook file not found: ${playbookPath}`);
}
}
}

const ir = new IncidentResponse();
ir.createIncident('123', 'Suspicious network activity');
ir.updateIncidentStatus('123', 'in-progress');
ir.executePlaybook('network-forensics');
