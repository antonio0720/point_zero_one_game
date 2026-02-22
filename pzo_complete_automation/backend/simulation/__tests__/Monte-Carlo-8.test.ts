import { describe, it, expect } from 'vitest';
import { monteCarloSimulation } from './Monte-Carlo-8';
import { randomUniform, randomNormal } from './utils';

describe('monteCarloSimulation', () => {
const functionUnderTest = (mu: number, sigma: number, n: number) => monteCarloSimulation(mu, sigma, n, randomUniform, randomNormal);

it('should return the correct mean and standard deviation for a single sample of normal distribution', () => {
const mu = 0;
const sigma = 1;
const n = 100_000;
const result = functionUnderTest(mu, sigma, n);

expect(result.mean).toBeCloseTo(mu, 3);
expect(result.standardDeviation).toBeCloseTo(sigma, 3);
});

it('should return the correct mean and standard deviation for multiple samples of normal distribution', () => {
const mu = 0;
const sigma = 1;
const n = 10_000;
const sampleSize = 100_000;
const results = Array.from({ length: n }, () => functionUnderTest(mu, sigma, sampleSize));

const means = results.map(r => r.mean);
const standardDeviations = results.map(r => r.standardDeviation);

expect(means).toStrictEqual(Array(n).fill(mu));
expect(standardDeviations).toStrictEqual(Array(n).fill(sigma));
});

it('should return the correct mean and standard deviation for a single sample of non-normal distribution', () => {
const mu = 0;
const sigma = 2;
const n = 100_000;
const result = functionUnderTest(mu, sigma, n, undefined, randomNormal);

expect(result.mean).toBeCloseTo(mu, 3);
expect(result.standardDeviation).toBeCloseTo(Math.sqrt((2 * Math.PI) / 5), 3); // Approximate standard deviation for a triangular distribution with range [0, 4]
});

it('should return the correct mean and standard deviation for multiple samples of non-normal distribution', () => {
const mu = 0;
const sigma = 2;
const n = 10_000;
const sampleSize = 100_000;
const results = Array.from({ length: n }, () => functionUnderTest(mu, sigma, sampleSize, undefined, randomNormal));

const means = results.map(r => r.mean);
const standardDeviations = results.map(r => r.standardDeviation);

expect(means).toStrictEqual(Array(n).fill(mu));
expect(standardDeviations).toStrictEqual(Array(n).fill(Math.sqrt((2 * Math.PI) / 5))); // Approximate standard deviation for a triangular distribution with range [0, 4]
});
});
