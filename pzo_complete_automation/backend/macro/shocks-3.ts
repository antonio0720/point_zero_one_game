interface MacroSystem {
C: number;
I: number;
G: number;
Y: number; // National Income
C_prop: number; // Consumption Propensity
r: number; // Interest Rate
}

function computeNationalIncome(system: MacroSystem): number {
return system.C + system.I + system.G;
}

function computePropensities(Y: number, C_prop: number): [number, number] {
const consumption = Y * C_prop;
const savings = Y - consumption;
return [consumption, savings];
}

function shockC(system: MacroSystem, deltaC: number): MacroSystem {
const [newC, newS] = computePropensities(system.Y + deltaC, system.C_prop);
return { ...system, C: newC };
}

function shockI(system: MacroSystem, deltaI: number): MacroSystem {
return { ...system, I: system.I + deltaI };
}

function shockG(system: MacroSystem, deltaG: number): MacroSystem {
return { ...system, G: system.G + deltaG };
}
