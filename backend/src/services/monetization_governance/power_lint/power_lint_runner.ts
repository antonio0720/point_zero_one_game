/**
 * Power Lint Runner
 */

import { Simulation } from './simulation';
import { ThresholdExceededError } from './errors';

/**
 * Runs a deterministic 10k-run simulation test for survival probability change.
 * Blocks if threshold exceeded.
 */
export class PowerLintRunner {
    private simulation: Simulation;
    private threshold: number;

    constructor(threshold: number) {
        this.threshold = threshold;
        this.simulation = new Simulation();
    }

    public async run(): Promise<void> {
        let survivalProbabilityChange: number = 0;
        for (let i = 0; i < 10000; i++) {
            const result = await this.simulation.run();
            survivalProbabilityChange += result.survivalProbabilityChange;
        }
        if (Math.abs(survivalProbabilityChange) > this.threshold) {
            throw new ThresholdExceededError(`Survival probability change exceeded threshold: ${this.threshold}`);
        }
    }
}

/**
 * Error thrown when the survival probability change threshold is exceeded.
 */
export class ThresholdExceededError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ThresholdExceededError';
    }
}
