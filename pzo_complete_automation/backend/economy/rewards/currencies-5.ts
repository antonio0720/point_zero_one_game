import { Map } from 'immutable';

interface Currency {
id: string;
name: string;
symbol: string;
}

interface Balance {
[currencyId: string]: number;
}

class EconomyEngine {
private currencies: Map<string, Currency>;
private balances: Map<string, Balance>;

constructor() {
this.currencies = Map();
this.balances = Map();
}

public createCurrency(currencyId: string, currencyName: string, currencySymbol: string): void {
if (this.currencies.has(currencyId)) throw new Error(`Currency with ID "${currencyId}" already exists`);
this.currencies = this.currencies.set(currencyId, { id: currencyId, name: currencyName, symbol: currencySymbol });
}

public addBalance(accountId: string, currencyId: string, amount: number): void {
if (!this.balances.has(accountId)) this.balances = this.balances.set(accountId, {});
const accountBalances = this.balances.get(accountId);
if (!accountBalances[currencyId]) accountBalances[currencyId] = 0;
accountBalances[currencyId] += amount;
this.balances = this.balances.set(accountId, accountBalances);
}

public getCurrencyByName(name: string): Currency | null {
return this.currencies.find(([_, currency]) => currency.name === name) || null;
}

public getAccountBalance(accountId: string, currencyId?: string): Balance | number {
if (currencyId) return this.balances.getIn([accountId, currencyId]);
return this.balances.get(accountId);
}
}
