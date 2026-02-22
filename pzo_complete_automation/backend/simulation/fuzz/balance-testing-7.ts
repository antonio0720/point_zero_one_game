import * as assert from 'assert';
import { BalanceService } from '../services/balance.service';
import { randomInt, randomFloat } from './utils';

const BALANCE_TEST_DATA = 100;
const ACCOUNT_ID_LENGTH = 8;

describe('Balance Service', () => {
let balanceService: BalanceService;

beforeEach(() => {
balanceService = new BalanceService();
});

it('should deposit and withdraw correctly', () => {
for (let i = 0; i < BALANCE_TEST_DATA; i++) {
const accountId = generateAccountId();
balanceService.deposit(accountId, randomFloat(100));
assert.strictEqual(balanceService.getBalance(accountId), randomFloat(100));

balanceService.withdraw(accountId, randomInt(50));
const balance = balanceService.getBalance(accountId);
assert.strictEqual(balance > 0, true);
}
});

it('should handle negative deposits', () => {
for (let i = 0; i < BALANCE_TEST_DATA; i++) {
const accountId = generateAccountId();
balanceService.deposit(accountId, randomInt(-100));
assert.strictEqual(balanceService.getBalance(accountId), 0);
}
});

it('should handle invalid account ids', () => {
const invalidAccountIds = Array.from({ length: BALANCE_TEST_DATA }, () => generateAccountId());
for (const id of invalidAccountIds) {
assert.throws(() => balanceService.getBalance(id), /Invalid Account Id/);
assert.throws(() => balanceService.deposit(id, 100), /Invalid Account Id/);
assert.throws(() => balanceService.withdraw(id, 100), /Invalid Account Id/);
}
});
});

function generateAccountId(): string {
let text = '';
const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
for (let i = 0; i < ACCOUNT_ID_LENGTH; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
return text;
}
