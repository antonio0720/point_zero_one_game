import { Currency } from './currency';

export class Economy {
private currencies: Map<string, Currency>;

constructor() {
this.currencies = new Map();
}

addCurrency(code: string, name: string): void {
const currency = new Currency(code, name);
this.currencies.set(code, currency);
}

getCurrencyByName(name: string): Currency | undefined {
return Array.from(this.currencies.values()).find((currency) => currency.name === name);
}

getCurrencyByCode(code: string): Currency | undefined {
return this.currencies.get(code);
}

removeCurrency(code: string): void {
this.currencies.delete(code);
}
}

export class Currency {
private code: string;
private name: string;

constructor(code: string, name: string) {
this.code = code;
this.name = name;
}

getCode(): string {
return this.code;
}

getName(): string {
return this.name;
}
}
