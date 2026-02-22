import * as assert from 'assert';
import * as fse from 'fs-extra';
import * as path from 'path';
import { createFuzzer } from 'fuzzy-tree-generator';

// Define the structure of your object to test
interface TestObject {
prop1: string;
prop2: number;
prop3?: boolean;
}

// Custom validator function for your object
function validate(obj: any): obj is TestObject {
return (
typeof obj.prop1 === 'string' &&
typeof obj.prop2 === 'number' &&
typeof obj.prop3 === 'boolean' || obj.prop3 === undefined
);
}

// Generate fuzzer for your object structure
const fuzzer = createFuzzer<TestObject>({
prop1: {
string: () => Math.random().toString(36).substring(2),
},
prop2: () => Math.floor(Math.random() * 100),
prop3: () => Math.random() > 0.5,
});

// Function to simulate the logic of your application
function simulateLogic(input: TestObject) {
// Add your application's logic here
}

// Main function for balance-testing-2
async function main() {
const inputFile = path.join(__dirname, 'inputs.json');
let data: TestObject[] = [];

try {
data = await fse.readJsonSync(inputFile);
} catch (err) {
console.error('Error reading inputs file:', err);
process.exit(1);
}

// Combine fuzzed inputs and predefined inputs
const allInputs = [...fuzzer.tree(5), ...data];

for (const input of allInputs) {
if (validate(input)) {
try {
simulateLogic(input);
console.log(`Balanced test passed for input: ${JSON.stringify(input)}`);
} catch (err) {
console.error(`Test failed for input: ${JSON.stringify(input)}`, err);
}
} else {
console.warn(`Input is not valid: ${JSON.stringify(input)}`);
}
}
}

main();
