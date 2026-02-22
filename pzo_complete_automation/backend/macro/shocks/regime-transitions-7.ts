import { System, state } from 'awilix';
import { MacroSystem, RegimeType, TransitionRule } from './macro-system';

class RegimeTransitions7 extends MacroSystem {
constructor(container: System) {
super(container);
this.registerRegimes();
this.registerRules();
}

private registerRegimes(): void {
// Define your regimes here, e.g.,:
this.registerRegime('Recession', {
name: 'recession',
initialConditions: [this.getCondition('unemploymentRate') >= 0.1],
indicators: [this.getIndicators(['unemploymentRate'])],
transitionsOut: this.createTransition(RegimeType.Growth, ['consumption', 'investment']),
});

// Add more regimes as needed
}

private registerRules(): void {
const consumptionRule = new TransitionRule('Increased Consumption', {
fromRegime: 'Stagnation',
toRegime: 'Growth',
conditions: [this.getCondition('disposableIncome') >= 500],
});

const investmentRule = new TransitionRule('Increased Investment', {
fromRegime: 'Stagnation',
toRegime: 'Growth',
conditions: [this.getCondition('interestRate') <= 0.1],
});

this.registerTransition(consumptionRule);
this.registerTransition(investmentRule);
}
}

export { RegimeTransitions7 };
