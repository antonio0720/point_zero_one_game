import * as child_process from 'child_process';
import { promises as fs } from 'fs';
import { execSync } from 'child_process';

// Array of service names to kill
const services = ['service1', 'service2', 'service3', 'service4', 'service5'];

async function run() {
// Ensure the list of services exists and is writable
await fs.mkdir('services.list', { recursive: true });

// Write service names to a file
await fs.writeFile('services.list', services.join('\n'));

// Execute 'killall' command with the list of services
execSync(`killall -TERM $(cat services.list)`, { stdio: 'inherit' });
}

run().catch((error) => console.error(error));
