import { Currency } from './currency';

export class EconomyEngine {
private currencies: Map<string, Currency>;

constructor() {
this.currencies = new Map();
}

addCurrency(code: string, name: string): void {
const currency = new Currency(code, name);
this.currencies.set(code, currency);
}

getCurrency(code: string): Currency | undefined {
return this.currencies.get(code);
}

removeCurrency(code: string): void {
this.currencies.delete(code);
}

convert(fromCode: string, toCode: string, amount: number): number {
const fromCurrency = this.getCurrency(fromCode);
if (!fromCurrency) throw new Error(`Currency ${fromCode} not found`);

const toCurrency = this.getCurrency(toCode);
if (!toCurrency) throw new Error(`Currency ${toCode} not found`);

return fromCurrency.convert(amount, toCurrency);
}
}

export class Currency {
private code: string;
private name: string;
private exchangeRate: Map<string, number>;

constructor(code: string, name: string) {
this.code = code;
this.name = name;
this.exchangeRate = new Map();
}

addExchangeRate(currencyCode: string, rate: number): void {
this.exchangeRate.set(currencyCode, rate);
}

getExchangeRate(currencyCode: string): number | undefined {
return this.exchangeRate.get(currencyCode);
}

convert(amount: number, targetCurrency: Currency): number {
const rate = this.getExchangeRate(targetCurrency.code) || 1;
return amount * rate;
}
}
