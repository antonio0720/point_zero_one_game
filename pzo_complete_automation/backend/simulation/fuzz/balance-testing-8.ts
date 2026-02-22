import { Balance } from './Balance';
import * as fuzzystruct from 'fuzzystruct';
import * as fs from 'fs';
import * as path from 'path';

const dataPath = path.join(__dirname, 'balances.txt');
const balancesData: Map<string, Balance> = new Map();

function loadBalances(): void {
if (fs.existsSync(dataPath)) {
const rawData = fs.readFileSync(dataPath, 'utf-8');
const lines = rawData.split('\n');

lines.forEach((line) => {
const [id, balanceStr] = line.split(': ');
const balance = new Balance(Number(balanceStr));
balancesData.set(id, balance);
});
}
}

function saveBalances(): void {
const dataArray: string[] = [];
for (const [id, balance] of balancesData) {
dataArray.push(`${id}: ${balance.toString()}`);
}
fs.writeFileSync(dataPath, dataArray.join('\n'));
}

function generateRandomBalance(): Balance {
return new Balance(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
}

const fuzzer = new fuzzystruct.Fuzzer();
fuzzer.addModel('balance', [
['add', (a: Balance, b: Balance) => a.add(b), 'Balance', 'Balance'],
['subtract', (a: Balance, b: Balance) => a.subtract(b), 'Balance', 'Balance'],
]);

function main(): void {
loadBalances();

fuzzer
.fuzz({ maxIterations: 10000 }, { balance: balancesData })
.then((result) => {
const [operation, a, b] = result.path;
const newBalanceA = balancesData.get(a)!;
const newBalanceB = balancesData.get(b)!;
const expectedResult = newBalanceA[operation as keyof Balance](newBalanceB);

console.log(`Fuzzed operation: ${operation}`);
console.log(`Original balance A: ${newBalanceA}`);
console.log(`Original balance B: ${newBalanceB}`);
console.log(`Expected result: ${expectedResult}`);
console.log(`Actual result: ${newBalanceA[operation as keyof Balance](newBalanceB)}`);
console.log();

balancesData.set(a, newBalanceA);
balancesData.set(b, newBalanceB);
saveBalances();
})
.catch((error) => {
console.error('Fuzzing failed:', error);
});
}

main();
