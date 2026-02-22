import { deterministicReplay3 } from '../deterministic-replay-3';
import { expect } from 'expect';

describe('deterministicReplay3', () => {
it('should return correct results for test cases', () => {
const testCases = [
{ input: [], output: [] },
{ input: [1], output: [1] },
{ input: [0, 1], output: [1, 0, -1] },
{ input: [3, 4, 5, 6], output: [-10, 4, -1, 5, 9] },
// Add more test cases here
];

testCases.forEach(({ input, output }) => {
expect(deterministicReplay3(input)).toEqual(output);
});
});
});
