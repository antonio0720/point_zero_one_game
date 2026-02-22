import { Currency } from "./currency";

export class EconomyEngine {
private currencies: Map<string, Currency>;

constructor() {
this.currencies = new Map();
}

addCurrency(code: string, name: string, initialAmount: number): void {
const currency = new Currency(code, name, initialAmount);
this.currencies.set(code, currency);
}

getCurrency(code: string): Currency | undefined {
return this.currencies.get(code);
}

exchange(fromCode: string, toCode: string, amount: number): void {
const fromCurrency = this.getCurrency(fromCode);
if (!fromCurrency) throw new Error("Invalid currency code");

const toCurrency = this.getCurrency(toCode);
if (!toCurrency) throw new Error("Invalid currency code");

const exchangeRate = fromCurrency.exchangeRateTo(toCurrency);
if (exchangeRate === undefined) {
throw new Error("Exchange rate not defined for these currencies");
}

const value = amount * exchangeRate;
toCurrency.addAmount(value);
fromCurrency.subtractAmount(amount);
}
}

export class Currency {
private code: string;
private name: string;
private amount: number;
private exchangeRates: Map<string, number>;

constructor(code: string, name: string, amount: number) {
this.code = code;
this.name = name;
this.amount = amount;
this.exchangeRates = new Map();
}

setExchangeRate(toCurrencyCode: string, rate: number): void {
this.exchangeRates.set(toCurrencyCode, rate);
}

exchangeRateTo(currency: Currency | null): number | undefined {
if (!currency) return undefined;

const reciprocalRate = currency.exchangeRates.get(this.code);
if (reciprocalRate === undefined) return undefined;

return 1 / reciprocalRate;
}

addAmount(amount: number): void {
this.amount += amount;
}

subtractAmount(amount: number): void {
if (this.amount < amount) throw new Error("Insufficient balance");

this.amount -= amount;
}
}
