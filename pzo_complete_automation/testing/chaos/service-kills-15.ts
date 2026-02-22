import * as child_process from 'child_process';
import { readFileSync } from 'fs';
import { promises as fsPromises } from 'fs';

const SERVICE_COUNT = 15;
const SERVICE_PIDS_FILE = './service_pids.txt';

async function main() {
const servicePids: number[] = await readServicePids();

for (let i = 0; i < SERVICE_COUNT; i++) {
killService(servicePids[i]);
}
}

function killService(pid: number) {
child_process.execSync(`kill ${pid}`);
}

async function readServicePids(): Promise<number[]> {
const servicePidsRaw = readFileSync(SERVICE_PIDS_FILE, 'utf-8').split('\n');
const servicePids: number[] = [];

for (const pidRaw of servicePidsRaw) {
const pid = parseInt(pidRaw, 10);

if (!isNaN(pid)) {
servicePids.push(pid);
}
}

return servicePids;
}

main().catch((error) => console.error(`An error occurred: ${error}`));
