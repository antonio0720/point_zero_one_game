import * as fuzz from 'fuzzters';

// Define a uniform distribution generator with min and max values.
function uniformGenerator(min: number, max: number) {
return function () {
return Math.random() * (max - min) + min;
};
}

// Monte Carlo simulation function.
function monteCarloSimulation(distribution: () => number, trials: number): number {
let sum = 0;
for (let i = 0; i < trials; i++) {
sum += distribution();
}
return sum / trials;
}

// Fuzzing harness for Monte Carlo simulation.
const inputSchema = fuzz.object([
fuzz.float('min', -10, 10),
fuzz.float('max', -10, 10),
fuzz.int('trials', 1, 1e6),
]);

const generateTestCases = (times: number) => {
for (let i = 0; i < times; i++) {
const testCase = inputSchema.generate();
console.log(testCase);
}
};

// Example usage with uniform distribution and 10,000 trials.
const min = 0;
const max = 100;
const trials = 10000;
console.log(`Estimated mean value: ${monteCarloSimulation(uniformGenerator(min, max), trials)}`);
generateTestCases(10);
