import * as fs from 'fs-extra';
import * as path from 'path';
import { readFileSync } from 'fs';
import { test, expect } from '@jest/globals';

interface Action {
name: string;
execute: (...args: any[]) => Promise<void>;
}

async function runActions(actions: Action[], inputDirectory: string): Promise<void> {
const inputFiles = await fs.readdir(inputDirectory);
for (const action of actions) {
for (const inputFile of inputFiles) {
const inputPath = path.join(inputDirectory, inputFile);
const content = readFileSync(inputPath).toString();
try {
await action.execute(content);
console.log(`${action.name} executed successfully with input: ${inputFile}`);
} catch (error) {
console.log(`${action.name} failed to execute with input: ${inputFile}\nError: ${error.message}`);
}
}
}
}

const actions: Action[] = [
{ name: 'Action1', execute: async (input: string) => { /* your action logic here */ } },
// Add more actions as needed...
];

test('action fuzzing test suite', () => {
const inputDirectory = './test/inputs'; // update this to point to the directory containing your test inputs
runActions(actions, inputDirectory).then(() => {
console.log('Test finished');
});
});
