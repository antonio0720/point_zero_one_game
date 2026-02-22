import { Simulation } from "../Monte-Carlo-3";
import * as fuzzystring from "fuzzystring";
import * as assert from "assert";

describe("Monte-Carlo-3", () => {
let simulation: Simulation;

beforeEach(() => {
simulation = new Simulation();
});

it("should return the correct result for a simple input", () => {
const input = [1, 2, 3];
const output = simulation.run(input);
assert.deepEqual(output, [0.5, 0.5]);
});

it("should handle arrays with different lengths", () => {
const input1 = [1, 2, 3];
const input2 = [4, 5];
const output1 = simulation.run(input1);
const output2 = simulation.run(input2);
assert.deepEqual(output1, [0.5, 0.5]);
assert.deepEqual(output2, [1, 0]);
});

it("should handle arrays with duplicates", () => {
const input = [1, 2, 2];
const output = simulation.run(input);
assert.deepEqual(output, [0.3333333333333333, 0.6666666666666667]);
});

it("should handle fuzzy inputs", () => {
const input1 = fuzzystring.pick(["1", "2", "3"]);
const input2 = fuzzystring.pick(["4", "5"]);
const output1 = simulation.run([input1 as any, 2, 3]);
const output2 = simulation.run([4, input2 as any]);

// Adjust the tolerances according to your needs
assert.ok(output1[0] >= 0.5 - 0.05 && output1[0] <= 0.5 + 0.05);
assert.ok(output2[1] >= 0.5 - 0.05 && output2[1] <= 0.5 + 0.05);
});
});
