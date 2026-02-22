import { Simulation } from '@macro-model/core';
import { RegimeTransition } from '../regime-transitions';
import { TimeSeries } from '@macro-model/time-series';
import { ShockType } from '@macro-model/shocks';
import { expect } from 'chai';
import sinon from 'sinon';

describe('RegimeTransitions', () => {
let simulation: Simulation;
let regimeTransition: RegimeTransition;

beforeEach(() => {
simulation = new Simulation();
regimeTransition = new RegimeTransition(simulation);
});

it('should handle a positive shock correctly', () => {
const shock = new TimeSeries([10]);
regimeTransition.registerShock(ShockType.MonetaryPolicyRate, shock);

simulation.run();

const monetaryPolicyRate = simulation.getSeries(ShockType.MonetaryPolicyRate).getData()[0];
expect(monetaryPolicyRate).to.be.greaterThan(regimeTransition.initialMonetaryPolicyRate);
});

it('should handle a negative shock correctly', () => {
const shock = new TimeSeries([-10]);
regimeTransition.registerShock(ShockType.MonetaryPolicyRate, shock);

simulation.run();

const monetaryPolicyRate = simulation.getSeries(ShockType.MonetaryPolicyRate).getData()[0];
expect(monetaryPolicyRate).to.be.lessThan(regimeTransition.initialMonetaryPolicyRate);
});

it('should handle no shocks correctly', () => {
simulation.run();

const monetaryPolicyRate = simulation.getSeries(ShockType.MonetaryPolicyRate).getData()[0];
expect(monetaryPolicyRate).to.be.closeTo(regimeTransition.initialMonetaryPolicyRate, 0.01);
});

it('should allow registering multiple shocks of the same type', () => {
const shock1 = new TimeSeries([10]);
const shock2 = new TimeSeries([-5]);

regimeTransition.registerShock(ShockType.MonetaryPolicyRate, shock1);
regimeTransition.registerShock(ShockType.MonetaryPolicyRate, shock2);

simulation.run();

const monetaryPolicyRate = simulation.getSeries(ShockType.MonetaryPolicyRate).getData()[0];
expect(monetaryPolicyRate).to.be.closeTo((regimeTransition.initialMonetaryPolicyRate + 10 - 5) / 2, 0.01);
});

it('should trigger a transition when the threshold is exceeded', () => {
const shock = new TimeSeries([15]);
regimeTransition.registerShock(ShockType.MonetaryPolicyRate, shock);
regimeTransition.setThreshold(10);

simulation.run();

expect(regimeTransition.transitionTriggered).to.be.true;
});

it('should not trigger a transition when the threshold is not exceeded', () => {
const shock = new TimeSeries([5]);
regimeTransition.registerShock(ShockType.MonetaryPolicyRate, shock);
regimeTransition.setThreshold(10);

simulation.run();

expect(regimeTransition.transitionTriggered).to.be.false;
});

it('should allow setting and getting the initial monetary policy rate', () => {
const initialRate = 0.05;
regimeTransition.setInitialMonetaryPolicyRate(initialRate);

expect(regimeTransition.getInitialMonetaryPolicyRate()).to.be.closeTo(initialRate, 0.01);
});

it('should allow setting and getting the threshold', () => {
const threshold = 10;
regimeTransition.setThreshold(threshold);

expect(regimeTransition.getThreshold()).to.be.closeTo(threshold, 0.01);
});
});
