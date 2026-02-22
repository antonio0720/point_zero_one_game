import * as assert from 'assert';
import * as fuzzystrap from 'fuzzystrap';
import { Balance } from './balance';

const balancer = new Balance();

// Fuzzer configuration
const maxDepth = 4;
const mutationOperators = [
fuzzystrap.operators.objectField(),
fuzzystrap.operators.arrayUniqueInsert(),
fuzzystrap.operators.arrayItem(),
];

// Fuzzer function to generate input data for the Balance class
const balanceFuzzer = fuzzystrap
.fuzzer(balancer)
.maxDepth(maxDepth)
.mutationOperators(...mutationOperators)
.build();

// Main testing function
const testBalance = (balance: any): void => {
try {
balancer.balance(balance);
console.log(`Test passed for input: ${JSON.stringify(balance)}`);
} catch (error) {
console.error(`Test failed for input: ${JSON.stringify(balance)}\nError:`, error);
assert.ok(false, 'Test failure');
}
};

// Run tests with fuzzer-generated data
for (let i = 0; i < 100; ++i) {
const balanceInput = balanceFuzzer.fuzz();
testBalance(balanceInput);
}
