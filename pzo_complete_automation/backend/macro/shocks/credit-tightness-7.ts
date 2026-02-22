type MacroVariables = {
gdp: number;
unemploymentRate: number;
inflationRate: number;
};

function creditTightnessImpact(initialValues: MacroVariables, tighteningFactor: number): MacroVariables {
const { gdp, unemploymentRate, inflationRate } = initialValues;

// Credit tightening impacts GDP and unemployment rate negatively
const impactOnGDP = -0.2 * tighteningFactor;
const impactOnUnemploymentRate = 0.1 * tighteningFactor;

// Inflation may increase due to reduced credit supply, but it's complex and uncertain, so let's assume a small positive effect for simplicity
const impactOnInflationRate = 0.05 * tighteningFactor;

return {
gdp: gdp - impactOnGDP,
unemploymentRate: unemploymentRate + impactOnUnemploymentRate,
inflationRate: inflationRate + impactOnInflationRate,
};
}
