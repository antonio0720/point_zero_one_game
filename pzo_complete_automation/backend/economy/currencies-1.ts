import { Currency } from "./currency";

export class Economy {
private currencies: Map<string, Currency>;

constructor() {
this.currencies = new Map();
}

addCurrency(code: string, name: string, initialQuantity?: number): void {
const currency = new Currency(code, name, initialQuantity || 0);
this.currencies.set(code, currency);
}

getCurrencyByName(name: string): Currency | undefined {
return Array.from(this.currencies.values()).find((currency) => currency.name === name);
}

getCurrencyByCode(code: string): Currency | undefined {
return this.currencies.get(code);
}

convertCurrency(fromCurrency: Currency, toCurrency: Currency, amount: number): number {
if (!fromCurrency || !toCurrency) throw new Error("Both source and destination currencies must be provided");
return toCurrency.convert(fromCurrency, amount);
}
}

export class Currency {
private code: string;
private name: string;
private quantity: number;

constructor(code: string, name: string, quantity: number) {
this.code = code;
this.name = name;
this.quantity = quantity;
}

getCode(): string {
return this.code;
}

getName(): string {
return this.name;
}

getQuantity(): number {
return this.quantity;
}

setQuantity(newQuantity: number): void {
this.quantity = newQuantity;
}

convert(otherCurrency: Currency, amount: number): number {
// Exchange rate logic goes here - for example, let's say each Dollar is worth 0.8 Euros:
return this.quantity * amount / otherCurrency.getQuantity();
}
}
