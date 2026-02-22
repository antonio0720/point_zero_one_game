import * as tape from 'tape';

type TestCase = {
title: string;
input: any[];
expectedOutput: any;
};

function deterministicReplay(testCases: TestCase[], fn) {
let testResults = {};

for (const test of testCases) {
const testTitle = `Testing ${test.title}`;
tape(testTitle, t => {
const result = fn(...test.input);
t.deepEqual(result, test.expectedOutput, testTitle);
testResults[testTitle] = result;
t.end();
});
}

return testResults;
}

function exampleFunction(a: number, b: number): number {
return a + b;
}

const testCases = [
{ title: 'Test case 1', input: [2, 3], expectedOutput: 5 },
// Add more test cases as needed
];

deterministicReplay(testCases, exampleFunction);
