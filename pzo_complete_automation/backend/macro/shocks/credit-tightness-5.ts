import { MacroSystem } from '@my-framework/macro';

export class CreditTightness5 extends MacroSystem {
private _interestRates: Record<string, number>;
private _creditScores: Record<string, number>;

constructor() {
super();
this._interestRates = {};
this._creditScores = {};
}

public onData({ interestRates, creditScores }) {
this._interestRates = interestRates;
this._creditScores = creditScores;
}

public calculate() {
const tightness = new Map();

Object.entries(this._interestRates).forEach(([entity, rate]) => {
const score = this._creditScores[entity];
if (score < 700) {
tightness.set(entity, rate * 1.2);
} else {
tightness.set(entity, rate);
}
});

return tightness;
}
}
