import { randomUniform } from 'math-fast';
import { Simulator, Sample, Result } from './interfaces';

interface FuzzerOptions {
maxIterations?: number;
minInputSize?: number;
maxInputSize?: number;
}

class MonteCarloSimulation implements Simulator {
private minInputSize: number;
private maxInputSize: number;
private maxIterations: number;

constructor(options?: FuzzerOptions) {
this.minInputSize = options?.minInputSize || 1;
this.maxInputSize = options?.maxInputSize || 100;
this.maxIterations = options?.maxIterations || 10000;
}

public simulate(input: number[]): Sample {
let result: Result = { pass: true, timeElapsed: 0 };
const startTime = performance.now();
for (let i = 0; i < this.maxIterations; i++) {
const randomInput = this.generateRandomInput(input);
const output = evaluateFunction(randomInput);
if (!output.pass) {
result.pass = false;
break;
}
}
const timeElapsed = performance.now() - startTime;
return { input, output, timeElapsed };
}

private generateRandomInput(input: number[]): number[] {
const size = Math.floor(randomUniform(this.minInputSize, this.maxInputSize));
const randomInput: number[] = [];
for (let i = 0; i < size; i++) {
randomInput.push(Math.floor(randomUniform(-100, 100)));
}
return [...input, ...randomInput];
}
}

function evaluateFunction(input: number[]): Result {
// Replace this with your actual function to be tested
const sum = input.reduce((acc, val) => acc + Math.pow(val, 2), 0);
return sum > 1 ? { pass: false } : { pass: true };
}

export default MonteCarloSimulation;
