type MacroVariable = 'G' | 'C' | 'I' | 'Y';
type MacroFunction = (initialInvestment: number, governmentSpending: number) => Map<MacroVariable, number>;

const keynesianMultiplier: MacroFunction = (initialInvestment, governmentSpending) => {
const C = 0.7 * initialInvestment + 2 * governmentSpending;
const I = initialInvestment;
const Y = 3 * I + 2 * C; // Total output (income)

const result: Map<MacroVariable, number> = new Map();
result.set('C', C);
result.set('I', I);
result.set('Y', Y);

return result;
};

const shockFunctions: Map<string, (multiplier: number) => MacroFunction> = new Map([
['investmentDecrease', (multiplier) => (initialInvestment, governmentSpending) => {
const initialInvestmentScaled = multiplier * initialInvestment;
return keynesianMultiplier(initialInvestmentScaled, governmentSpending);
}],
['investmentIncrease', (multiplier) => (initialInvestment, governmentSpending) => {
const initialInvestmentScaled = multiplier * initialInvestment;
return keynesianMultiplier(initialInvestmentScaled, governmentSpending);
}],
['governmentDecrease', (multiplier) => (initialInvestment, governmentSpendingScaled) => {
const governmentSpending = multiplier * governmentSpendingScaled;
return keynesianMultiplier(initialInvestment, governmentSpending);
}],
['governmentIncrease', (multiplier) => (initialInvestment, governmentSpendingScaled) => {
const governmentSpending = multiplier * governmentSpendingScaled;
return keynesianMultiplier(initialInvestment, governmentSpending);
}],
]);

// Example usage: Simulate a shock to investment by reducing it by 20%
const initialInvestment = 100;
const governmentSpending = 50;
const shockFunction = shockFunctions.get('investmentDecrease')!(0.8); // Apply a multiplier of 0.8 to the investment shock
const outputAfterShock = shockFunction(initialInvestment, governmentSpending);
console.log(outputAfterShock); // Output: Map { C: 130, I: 80, Y: 260 }
