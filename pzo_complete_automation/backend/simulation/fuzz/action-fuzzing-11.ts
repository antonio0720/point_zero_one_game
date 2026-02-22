import { Simulation } from './simulation';
import { Fuzzer } from './fuzzer';

class ActionFuzzer extends Fuzzer<Simulation> {
constructor(private readonly sim: Simulation) {
super();
}

generateInput(): any {
// Implement a method to generate random or mutated simulation input here.
// For example, using libraries like faker or jest-circus for generating random data.
throw new Error('Not implemented');
}

mutateInput(input: any): any {
// Implement a method to mutate the generated input for fuzz testing purposes.
// This could involve changing values, adding/removing properties, etc.
throw new Error('Not implemented');
}

async run(input: any): Promise<void> {
try {
this.sim.executeAction(input);
} catch (error) {
console.log(`Fuzz case encountered an error: ${error}`);
// Save the erroneous input for future analysis or reporting.
}
}
}

export { ActionFuzzer };
