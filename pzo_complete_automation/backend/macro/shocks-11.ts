import { MacroSystem } from "./macro-system";

export class Shocks11 extends MacroSystem {
constructor() {
super("Shocks11");

// Define the macros for this system
this.addMacro({ name: "GDP", initialValue: 100 });
this.addMacro({ name: "CPI", initialValue: 50 });
this.addMacro({ name: "UnemploymentRate", initialValue: 4.2 });

// Define the shock factors for each macro
const GDPShockFactors = [
{ name: "TechnologicalProgress", factor: 1.5, probability: 0.3 },
{ name: "ConsumerConfidence", factor: -0.8, probability: 0.4 },
{ name: "GovernmentPolicy", factor: -0.25, probability: 0.2 },
];

const CPIShockFactors = [
{ name: "InflationExpectations", factor: 1.3, probability: 0.4 },
{ name: "OilPrices", factor: -0.75, probability: 0.3 },
{ name: "ImportPrices", factor: 1.2, probability: 0.3 },
];

const UnemploymentRateShockFactors = [
{ name: "LaborProductivity", factor: -0.5, probability: 0.4 },
{ name: "WageRigidity", factor: 1.2, probability: 0.3 },
{ name: "DemographicChanges", factor: -0.8, probability: 0.3 },
];

// Define the simulation function
this.simulate = (timeStep: number) => {
if (Math.random() < 0.1) {
const shockFactorIndex = Math.floor(Math.random() * 3);
switch (this.macros[0].name) {
case "GDP":
this.applyShock(GDPShockFactors[shockFactorIndex]);
break;
case "CPI":
this.applyShock(CPIShockFactors[shockFactorIndex]);
break;
case "UnemploymentRate":
this.applyShock(UnemploymentRateShockFactors[shockFactorIndex]);
break;
}
}

// Simulate the time step for each macro
for (const macro of this.macros) {
if (macro.name === "GDP") {
macro.value += Math.random() * 2 - 1;
} else if (macro.name === "CPI") {
macro.value += Math.random() * 1 + 0.5;
} else if (macro.name === "UnemploymentRate") {
macro.value += Math.random() * 2 - 1;
}
}
};
}
}
