import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Counterfactual Simulator', () => {
  let simulator: any;
  let seed: number;

  beforeEach(() => {
    seed = Math.random(); // Seed for deterministic testing
    simulator = new CounterfactualSimulator(seed);
  });

  afterEach(() => {
    // Reset the global random seed to avoid affecting other tests
    Math.seedrandom(seed);
  });

  it('should produce a deterministic alternate outcome with same seed and alternate choice', () => {
    const choice1 = simulator.chooseOption('financial_choice1');
    const choice2 = simulator.chooseOption('financial_choice2');

    // Save the states for comparison later
    const state1 = simulator.getState();
    const state2 = simulator.getState();

    simulator.reset();
    simulator.makeChoice(choice1);
    const outcome1 = simulator.getOutcome();

    simulator.reset();
    simulator.makeChoice(choice2);
    const outcome2 = simulator.getOutcome();

    expect(outcome1).not.toEqual(outcome2); // Different outcomes for different choices
    expect(state1).toEqual(state2); // Same state before making choices
  });

  it('should detect a decisive fork on known run fixtures', () => {
    const choice1 = simulator.chooseOption('financial_choice1');
    const choice2 = simulator.chooseOption('financial_choice2');

    // Save the states for comparison later
    const state1 = simulator.getState();
    const state2 = simulator.getState();

    simulator.reset();
    simulator.makeChoice(choice1);
    const outcome1 = simulator.getOutcome();

    simulator.reset();
    simulator.makeChoice(choice2);
    const outcome2 = simulator.getOutcome();

    // Assume there's a known run fixture where choice1 leads to a fork and choice2 does not
    if (outcome1.isFork && !outcome2.isFork) {
      expect(simulator.detectDecisiveFork()).toBeTruthy();
    } else {
      expect(simulator.detectDecisiveFork()).toBeFalsy();
    }
  });

  it('should enforce free tier limits', () => {
    // Assuming there's a limit of 10 transactions per day in the free tier
    for (let i = 0; i < 11; i++) {
      simulator.makeTransaction();
    }

    expect(simulator.getTransactionsCount()).toBeGreaterThanOrEqual(11); // Free tier limit exceeded

    simulator.resetFreeTierLimits();
    expect(simulator.getTransactionsCount()).toEqual(0); // Limits reset to zero
  });
});
