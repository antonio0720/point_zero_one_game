class Economy {
capital: number;
labor: number;
technologyLevel: number;
preferenceParameters: PreferenceParameters;

constructor(capital: number, labor: number, technologyLevel: number, preferenceParameters: PreferenceParameters) {
this.capital = capital;
this.labor = labor;
this.technologyLevel = technologyLevel;
this.preferenceParameters = preferenceParameters;
}

calculateConsumption(): number {
return this.labor * this.preferenceParameters.consumptionLabor share;
}

calculateProduction(): number {
const productionFunctionParameters = {
laborElasticity: this.preferenceParameters.productionLaborElasticity,
capitalElasticity: this.preferenceParameters.productionCapitalElasticity,
technologyLevelMultiplier: this.technologyLevel
};
return Math.pow(this.capital * productionFunctionParameters.capitalElasticity + this.labor * productionFunctionParameters.laborElasticity, 1 / productionFunctionParameters.laborElasticity);
}
}

interface PreferenceParameters {
consumptionLaborShare: number;
productionLaborElasticity: number;
productionCapitalElasticity: number;
}

class Shock {
type: string;
magnitude: number;
timing: number;

constructor(type: string, magnitude: number, timing: number) {
this.type = type;
this.magnitude = magnitude;
this.timing = timing;
}
}

function applyShock(economy: Economy, shock: Shock): Economy {
if (shock.type === 'technology') {
return new Economy(economy.capital, economy.labor, economy.technologyLevel + shock.magnitude, economy.preferenceParameters);
} else if (shock.type === 'preference') {
const updatedPreferenceParameters = { ...economy.preferenceParameters };
updatedPreferenceParameters[shock.type] += shock.magnitude;
return new Economy(economy.capital, economy.labor, economy.technologyLevel, updatedPreferenceParameters);
}
throw Error('Invalid shock type');
}
