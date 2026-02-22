export interface Economy {
gdp: number;
inflationRate: number;
unemploymentRate: number;
}

export interface Regime {
name: string;
initialConditions: Economy;
stateTransitions: (economy: Economy) => Economy;
transitionProbabilities: (currentRegime: string, economy: Economy) => number[];
}

export const regime1: Regime = {
name: 'Normal',
initialConditions: {
gdp: 100,
inflationRate: 2.5,
unemploymentRate: 5
},
stateTransitions: (economy) => ({
gdp: economy.gdp * 1.02,
inflationRate: economy.inflationRate * 1.03,
unemploymentRate: economy.unemploymentRate * 0.98
}),
transitionProbabilities: (currentRegime, economy) => {
if (currentRegime === 'Recession') return [0.2, 0.8];
return [0.8, 0.2];
}
};

export const regime2: Regime = {
name: 'Recession',
initialConditions: {
gdp: 50,
inflationRate: 3.5,
unemploymentRate: 10
},
stateTransitions: (economy) => ({
gdp: economy.gdp * 0.98,
inflationRate: economy.inflationRate * 1.02,
unemploymentRate: economy.unemploymentRate * 1.02
}),
transitionProbabilities: (currentRegime, economy) => {
if (currentRegime === 'Normal') return [0.5, 0.5];
return [0.1, 0.9];
}
};

function simulate(regimes: Regime[], initialConditions: Economy, simulationSteps: number) {
const currentRegime = 'Normal';
let economy = initialConditions;
const history: Economy[] = [initialConditions];

for (let step = 1; step <= simulationSteps; step++) {
const [probNormal, probRecession] = regimes.find((r) => r.name === currentRegime)!.transitionProbabilities(currentRegime, economy);
const randomNumber = Math.random();

if (randomNumber <= probNormal) {
economy = regimes.find((r) => r.name === currentRegime)!.stateTransitions(economy);
} else {
economy = regimes.find((r) => r.name === 'Recession')!.stateTransitions(economy);
currentRegime === 'Normal' ? (currentRegime = 'Recession') : (currentRegime = 'Normal');
}

history.push(economy);
}

return history;
}
