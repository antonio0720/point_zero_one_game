import * as assert from 'assert';
import { Action } from './action';
import { random } from 'random-factory';

class Fuzzer {
private actions: Action[];

constructor(actions: Action[]) {
this.actions = actions;
}

public fuzz() {
const actionIndex = random(0, this.actions.length - 1);
this.actions[actionIndex].execute();
}
}

class Simulation {
private fuzzer: Fuzzer;

constructor(fuzzer: Fuzzer) {
this.fuzzer = fuzzer;
}

public run() {
for (let i = 0; i < 10000; i++) {
this.fuzzer.fuzz();
}
}
}

function main() {
const actionOne = new Action('Action One');
const actionTwo = new Action('Action Two');
const actionThree = new Action('Action Three');

const actions = [actionOne, actionTwo, actionThree];

const fuzzer = new Fuzzer(actions);
const simulation = new Simulation(fuzzer);

// Customize the crash threshold if needed. In this example, it's set to 5 crashes before exiting.
let crashCount = 0;

try {
simulation.run();
} catch (error) {
console.error('Encountered an error:', error);
crashCount++;

if (crashCount > 5) {
assert.ok(false, 'Simulation failed too many times.');
process.exit(1);
}
}
}

main();
