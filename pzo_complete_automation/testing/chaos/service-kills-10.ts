import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const services = ['service1', 'service2', 'service3']; // Replace with the list of services to be tested
const serviceKills = 10;

function randomElement(arr: any[]): any {
return arr[Math.floor(Math.random() * arr.length)];
}

function runCommand(command: string) {
try {
execSync(command, { stdio: 'inherit' });
} catch (error) {
console.error(`Error running command: ${error}`);
}
}

for (let i = 0; i < serviceKills; i++) {
const randomService = randomElement(services);
runCommand(`kill $(lsof -t -p $(pgrep ${randomService}) -s 9)`);
}
