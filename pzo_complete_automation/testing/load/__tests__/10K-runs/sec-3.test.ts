import { secThree } from './index';
import { describe, it, expect } from 'vitest';

describe('Sec Three', () => {
it('should return expected result for given input', () => {
const input = 5;
const expectedOutput = 15;
expect(secThree(input)).toEqual(expectedOutput);
});

it('should handle negative numbers', () => {
const input = -3;
const expectedOutput = -9;
expect(secThree(input)).toEqual(expectedOutput);
});

it('should handle zero as input', () => {
const input = 0;
const expectedOutput = 0;
expect(secThree(input)).toEqual(expectedOutput);
});

// Add more test cases if necessary
});
