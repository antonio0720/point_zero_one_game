import { System, Signal } from "mtjs";
import { RegimeTransitionSignal } from "./signals/regime-transition-signal";
import { EconomicVariable } from "../economic-variables";

class RegimeTransitionsSystem extends System {
private gdp: EconomicVariable;
private inflation: EconomicVariable;
private interestRate: EconomicVariable;

constructor() {
super();
this.gdp = new EconomicVariable("GDP");
this.inflation = new EconomicVariable("Inflation");
this.interestRate = new EconomicVariable("Interest Rate");

// Define your logic for the regime transitions here
const transitionSignal = new RegimeTransitionSignal(this.gdp, this.inflation);

this.add(transitionSignal);

// Connect signals to economic variables
transitionSignal.connect(this.interestRate);
}
}

export { RegimeTransitionsSystem };
