import { System, State, ContinuousState } from 'awilhelmsen-fsm';
import { MacroShock } from './macro-shock';
import { Regime } from './regime';

export class RegimeTransitions8 extends System<Regime> {
private _regimes: Map<string, Regime>;
private _currentRegime: Regime;
private _shocks: MacroShock[];

constructor(initRegimes: Record<string, Partial<Regime>> = {}) {
super();
this._regimes = new Map(Object.entries(initRegimes));
this._currentRegime = this.getInitialRegime()!;
this._shocks = [];
}

public addShock(shock: MacroShock) {
this._shocks.push(shock);
}

public transition(state: State<Regime>) {
const nextState = super.transition(state);
if (nextState && this._currentRegime.onTransition(this)) {
this._currentRegime = this.getRegime(nextState.value)!;
}
return nextState;
}

public getInitialRegime(): Regime | undefined {
return this._regimes.get('initial') || this._regimes.values().next().value;
}

public getRegime(name: string): Regime | undefined {
return this._regimes.get(name);
}

public applyShocks() {
this._shocks.forEach((shock) => shock.apply());
}
}
