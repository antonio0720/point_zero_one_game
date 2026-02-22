import { Balance } from '../models/balance';
import { generateRandomBalance } from './utils';
import { fuzzTesting } from 'fuzzystrip';

const MIN_BALANCE = 0;
const MAX_BALANCE = 1e9;
const BALANCES_COUNT = 10000;

function generateBalances(count: number): Balance[] {
return Array.from({ length: count }, () => generateRandomBalance(MIN_BALANCE, MAX_BALANCE));
}

function testBalances(balances: Balance[]): void {
for (const balance of balances) {
const { amount } = balance;
// Add your balance-related tests here
fuzzTesting(amount.toString(), '^[-+]?[0-9]*\\.?[0-9]+$');
}
}

function main(): void {
const balances = generateBalances(BALANCES_COUNT);
testBalances(balances);
}

main();
