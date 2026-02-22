import * as yargs from 'yargs';
import fetch from 'node-fetch';

const argv = yargs
.option('incidentId', { alias: 'i', description: 'Incident ID', type: 'number' })
.help()
.alias('help', 'h').argv;

async function getIncidentDetails(incidentId: number) {
const response = await fetch(`https://alerting-api.example.com/incidents/${incidentId}`);
if (!response.ok) throw new Error(`Error getting incident details: ${response.statusText}`);
return await response.json();
}

async function notifyOnCallTeam(incidentDetails) {
// Implement your own notification logic here (e.g., sending an email, Slack message, etc.)
console.log(`Notifying on-call team for incident ${incidentDetails.title}`);
}

async function main() {
if (!argv.incidentId) {
console.error('Incident ID is required');
process.exit(1);
}

try {
const incidentDetails = await getIncidentDetails(argv.incidentId);
notifyOnCallTeam(incidentDetails);
} catch (e) {
console.error(e.message);
process.exit(1);
}
}

main();
