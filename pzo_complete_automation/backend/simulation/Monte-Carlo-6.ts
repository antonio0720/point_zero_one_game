import { random, RandomSource } from "random-js";
import assert from "assert";

// Define the simulation function for six simulations
function simulateSix(input: number[], rand: RandomSource): [number, number] {
const sampleSize = input.length;
let totalSimulations = 0;
let successCount = 0;

for (let i = 0; i < sampleSize; ++i) {
if (input[rand.int(sampleSize)] <= rand.real()) {
++successCount;
}
++totalSimulations;
}

return [successCount, totalSimulations];
}

// Generate random input and run the simulation using the provided fuzzing function
function fuzz<T>(fuzzer: (input: T) => T, assertion: (output: any[]) => void, minValue: number, maxValue: number, numSamples: number, repetitions: number) {
const randomInput = Array.from({ length: numSamples }, () => fuzzer(random.integer(minValue, maxValue)));
for (let i = 0; i < repetitions; ++i) {
const [successCount, totalSimulations] = simulateSix(randomInput, random);
assert.ok(totalSimulations >= repetitions * numSamples, `Total simulations must be greater than or equal to ${repetitions * numSamples}`);
assert.ok(successCount <= repetitions * numSamples, `Success count must be less than or equal to ${repetitions * numSamples}`);
}
}

// A simple function that fuzzes an input array by incrementing each value by a random amount
function incrementFuzzer(input: number[]) {
return input.map((value) => value + random.real(-1, 2));
}

fuzz(incrementFuzzer, (output) => {
assert.ok(output[0] >= 0, "Success count must be non-negative");
assert.ok(output[1] === output[0], "Total simulations must equal success count");
}, 0, 100, 1000, 10);
