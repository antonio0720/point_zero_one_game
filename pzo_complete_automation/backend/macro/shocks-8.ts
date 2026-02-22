interface Shock {
name: string;
apply(economy: Economy): void;
}

class FiscalPolicyShock implements Shock {
constructor(private amount: number) {}

get name() {
return `Fiscal Policy (${this.amount})`;
}

apply(economy: Economy) {
economy.governmentBudget += this.amount;
}
}

class MonetaryPolicyShock implements Shock {
constructor(private rate: number) {}

get name() {
return `Monetary Policy (${this.rate})`;
}

apply(economy: Economy) {
economy.interestRate += this.rate;
}
}

// Additional shock classes for Technology, Population, Trade, and so on...

abstract class EconomyObserver {
abstract update(): void;

setState(state: Economy) {
this.state = state;
this.update();
}

protected state: Economy | undefined;
}

class Economist extends EconomyObserver {}

class CentralBank extends EconomyObserver {}

class Government extends EconomyObserver {}

// MacroEconomy class encapsulates the current economic state and manages shocks
class MacroEconomy {
constructor(private observers: EconomyObserver[]) {}

public governmentBudget = 0;
public interestRate = 0;

addObserver(observer: EconomyObserver) {
this.observers.push(observer);
}

applyShock(shock: Shock) {
shock.apply(this);
this.observers.forEach((observer) => observer.setState(this));
}
}

// Example usage
const economy = new MacroEconomy([new Economist(), new CentralBank(), new Government()]);
economy.addObserver(new Economist());
economy.addObserver(new CentralBank());
economy.addObserver(new Government());

const fiscalPolicyShock = new FiscalPolicyShock(-100);
economy.applyShock(fiscalPolicyShock);
