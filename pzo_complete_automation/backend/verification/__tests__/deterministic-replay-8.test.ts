import { describe, it, expect } from 'vitest';
import { deterministicReplay } from './deterministic-replay';

describe('deterministic-replay-8', () => {
const data = [
// Add your test cases here as arrays with input and expected output.
// Example: [ ['input1', 'expected1'], ['input2', 'expected2'] ]
];

data.forEach(([input, expected]) => {
it(`should return ${expected} for input ${JSON.stringify(input)}`, () => {
expect(deterministicReplay(input)).toEqual(expected);
});
});
});
