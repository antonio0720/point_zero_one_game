interface EconomicIndicator {
name: string;
initialValue: number;
}

class MacroSystem {
private indicators: Map<string, number>;

constructor(indicators: EconomicIndicator[]) {
this.indicators = new Map();

indicators.forEach(({ name, initialValue }) => {
this.indicators.set(name, initialValue);
});
}

public applyShock(shockName: string, shockIntensity: number) {
const indicator = this.indicators.get(shockName);

if (!indicator) throw new Error(`No economic indicator named "${shockName}"`);

let newValue = indicator * (1 + shockIntensity);

// Limit the minimum and maximum value of each indicator to prevent unusual values
this.indicators.set(shockName, Math.max(this.indicators.get(shockName)!, 0) * Math.min(1 + shockIntensity, 5));
}
}

const gdp: EconomicIndicator = { name: "GDP", initialValue: 100 };
const consumption: EconomicIndicator = { name: "Consumption", initialValue: 60 };
const investment: EconomicIndicator = { name: "Investment", initialValue: 40 };
const exports: EconomicIndicator = { name: "Exports", initialValue: 30 };

const macroSystem = new MacroSystem([gdp, consumption, investment, exports]);

// Apply a positive shock to GDP
macroSystem.applyShock("GDP", 0.2);
console.log(macroSystem.indicators);
