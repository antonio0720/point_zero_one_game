import { Model } from 'rustling';

class MacroSystem extends Model {
// Define parameters and variables of the model
c: number = 0.7; // consumption share
k: number = 1 - c; // capital share
alpha: number = 0.3; // depreciation rate
beta: number = 0.96; // discount factor
rho: number = 0.98; // autoregressive coefficient for productivity shocks
epsilon: number = 0.1; // standard deviation of productivity shocks

y: number = 0; // output
k_t1: number = 0; // next period capital stock
z: number = 0; // productivity shock
u: number = 0; // utility

constructor() {
super();
this.initializeVariables();
}

initializeVariables(): void {
this.z = this.gaussianNoise(0, this.epsilon);
this.y = this.calculateOutput();
this.k_t1 = this.calculateNextPeriodCapital();
this.u = this.calculateUtility();
}

calculateOutput(): number {
return Math.pow(this.z, 0.5) * Math.pow(this.k, 0.5);
}

calculateNextPeriodCapital(): number {
return (1 - this.alpha) * this.k + this.c * this.y;
}

calculateUtility(): number {
return Math.pow((1 + this.y)**(1 - this.beta), this.beta);
}

gaussianNoise(mean: number, stdDev: number): number {
const u1 = Math.random();
const u2 = Math.random();
const sigma = stdDev * Math.sqrt(-2 * Math.log(u1));
return mean + sigma * Math.cos(2 * Math.PI * u2);
}
}

// Run the simulation for a specific number of periods
function runSimulation(numPeriods: number, initialCapital: number): void {
const macrosystem = new MacroSystem();
let k = initialCapital;

for (let t = 1; t <= numPeriods; t++) {
macrosystem.initializeVariables();
k = macrosystem.k_t1;
}

console.log(`Final capital stock after ${numPeriods} periods: ${k}`);
}

// Example usage
runSimulation(50, 100);
