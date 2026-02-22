import { MacroSystem } from './macro-system';

class Regime1 extends MacroSystem {
constructor(name = 'Regime1') {
super({
name,
initialState: {
gdp: 100,
inflation: 2,
interestRate: 5
},
transitionRules: {
nextPeriod: ({ state }) => ({
gdp: state.gdp * (1 + 0.03), // 3% GDP growth
inflation: state.inflation * (1 + 0.02), // 2% inflation increase
interestRate: state.interestRate - 1 // interest rate decreases by 1 unit
})
}
});
}
}

class Regime2 extends MacroSystem {
constructor(name = 'Regime2') {
super({
name,
initialState: {
gdp: 50,
inflation: 3,
interestRate: 10
},
transitionRules: {
nextPeriod: ({ state }) => ({
gdp: state.gdp * (1 - 0.04), // 4% GDP contraction
inflation: state.inflation * (1 + 0.03), // 3% inflation increase
interestRate: state.interestRate + 2 // interest rate increases by 2 units
}),
transitionConditions: ({ state }) => state.gdp < 75 // transition to Regime1 when GDP is less than 75
}
});
}
}

export { Regime1, Regime2 };
