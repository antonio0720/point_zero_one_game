import { Currency } from "./currency";

class EconomyEngine {
private currencies: Map<string, Currency>;

constructor() {
this.currencies = new Map();
}

addCurrency(code: string, initialAmount: number): void {
const currency = new Currency(code, initialAmount);
this.currencies.set(currency.code, currency);
}

deposit(code: string, amount: number): void {
const currency = this.currencies.get(code);
if (currency) {
currency.deposit(amount);
} else {
throw new Error(`Currency ${code} not found`);
}
}

withdraw(code: string, amount: number): void {
const currency = this.currencies.get(code);
if (currency) {
currency.withdraw(amount);
} else {
throw new Error(`Currency ${code} not found`);
}
}

balance(code: string): number {
const currency = this.currencies.get(code);
return currency ? currency.balance : 0;
}

transfer(fromCode: string, toCode: string, amount: number): void {
const fromCurrency = this.currencies.get(fromCode);
const toCurrency = this.currencies.get(toCode);

if (fromCurrency && toCurrency) {
fromCurrency.withdraw(amount);
toCurrency.deposit(amount);
} else {
throw new Error(`One or both currencies ${fromCode} and ${toCode} not found`);
}
}
}

class Currency {
private code: string;
private balance: number;

constructor(code: string, initialBalance: number) {
this.code = code;
this.balance = initialBalance;
}

deposit(amount: number): void {
this.balance += amount;
}

withdraw(amount: number): void {
if (amount > this.balance) {
throw new Error("Insufficient balance");
}
this.balance -= amount;
}

balance: number {
return this.balance;
}
}
