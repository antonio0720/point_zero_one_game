import { Balance } from '../balance';
import * as fuzzystrp from 'fuzzystrp';
import * as fs from 'fs';
import * as path from 'path';
import { readFileSync } from 'fs';

describe('Balance', () => {
let balance: Balance;

beforeEach(() => {
balance = new Balance();
});

it('should initialize with a zero balance', () => {
expect(balance.getBalance()).toEqual(0);
});

describe('deposit', () => {
it('should correctly add funds to the account', () => {
const initialBalance = balance.getBalance();
balance.deposit(100);
expect(balance.getBalance()).toEqual(initialBalance + 100);
});

it('should reject negative amounts', () => {
expect(() => balance.deposit(-10)).toThrowError();
});
});

describe('withdraw', () => {
let initialBalance;

beforeEach(() => {
initialBalance = balance.getBalance();
balance.deposit(100);
});

it('should correctly remove funds from the account', () => {
balance.withdraw(50);
expect(balance.getBalance()).toEqual(initialBalance - 50);
});

it('should reject withdrawing more than the available balance', () => {
expect(() => balance.withdraw(150)).toThrowError();
});
});

describe('fuzz tests', () => {
const data = readFileSync(path.join(__dirname, 'data.json'), 'utf8');
const fuzzer = new fuzzystrp.Fuzzer();

it('should correctly perform deposits and withdrawals using fuzzed amounts', () => {
for (const transaction of JSON.parse(data)) {
if (transaction === 'deposit') {
balance.deposit(fuzzer.pickRandom(1, 100));
} else if (transaction === 'withdraw') {
const amount = fuzzer.pickRandom(1, balance.getBalance());
balance.withdraw(amount);
expect(balance.getBalance()).toEqual(balance.getBalance() - amount);
}
}
});
});
});
