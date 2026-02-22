import * as child_process from 'child_process';
import * as os from 'os';
import { randomInt } from 'crypto';

const maxProcesses = 10; // Maximum number of processes
const killProbability = 0.2; // Probability of killing a process on each iteration

// List of running processes
let processes: NodeJS.ChildProcess[] = [];

function startNewProcess() {
const command = 'your-app'; // Replace with your app command
const newProcess = child_process.spawn(command);
processes.push(newProcess);
}

function killRandomProcess() {
if (Math.random() < killProbability) {
const randomIndex = Math.floor(Math.random() * processes.length);
processes[randomIndex].kill();
processes.splice(randomIndex, 1);
}
}

function run() {
if (processes.length < maxProcesses) {
startNewProcess();
}
killRandomProcess();

// Check if all processes are still running
let alive = true;
for (const process of processes) {
if (!process.stderr.isOpen || !process.stdout.isOpen) continue;

const status = process.status;
if (status === null || status !== 0) {
alive = false;
break;
}
}

// If all processes are dead, restart the process loop
if (!alive) {
clearInterval(intervalId);
processes = [];
startNewProcess();
}
}

let intervalId = setInterval(run, 1000);
