import * as assert from 'assert';
import * as fs from 'fs';
import * as fuzzysort from 'fuzzysearch';
import * as yaml from 'js-yaml';

interface TestCase {
input: any;
expectedOutput: any;
}

const testCases = yaml.load(fs.readFileSync('test_cases.yml', 'utf8')) as TestCase[];

function fairFunction(input: any): any {
// Implement your function here
throw new Error("Function not implemented");
}

function generateFuzzedInputs(testCase: TestCase) {
const fuzzer = new fuzzysort.FuzzySet(JSON.stringify(testCase.input));
const fuzzedInputs = [];

for (let i = 0; i < 100; i++) {
const mutatedInput = JSON.parse(fuzzer.pick() as string);
if (!Array.isArray(mutatedInput) || mutatedInput.every((element) => typeof element === 'object')) {
fuzzedInputs.push(mutatedInput);
}
}

return fuzzedInputs;
}

function runTests(testCases: TestCase[], fairFunction: Function) {
let passed = 0;
let total = testCases.length;

for (const testCase of testCases) {
const fuzzedInputs = generateFuzzedInputs(testCase);

for (const input of fuzzedInputs) {
const output = fairFunction(input);

if (JSON.stringify(output) === JSON.stringify(testCase.expectedOutput)) {
passed++;
}
}
}

console.log(`${passed} out of ${total} tests passed`);
}

runTests(testCases, fairFunction);
