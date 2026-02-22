import { FraudDetection9 } from '../fraud-detection-9';
import { Money } from '../../../currency/money';
import { Account } from '../../account';
import { Transaction } from '../../transaction';
import { stub } from 'ts-mockito';

describe('Economy engine - fraud detection 9', () => {
const account1 = new Account('123456789');
const account2 = new Account('098765432');

let fraudDetection: FraudDetection9;

beforeEach(() => {
fraudDetection = new FraudDetection9();
});

it('should not detect fraud for valid transactions', () => {
const transaction1 = new Transaction(account1, account2, new Money(100));
const transaction2 = new Transaction(account2, account1, new Money(50));

expect(fraudDetection.detectFraud(transaction1)).toBe(false);
expect(fraudDetection.detectFraud(transaction2)).toBe(false);
});

it('should detect fraud for same account transactions', () => {
const transaction = new Transaction(account1, account1, new Money(100));

expect(fraudDetection.detectFraud(transaction)).toBe(true);
});

it('should detect fraud for large number of transactions between accounts', () => {
const smallTransaction = stub(Transaction, 'fromJson');
smallTransaction.withArgs({ amount: 10, accountFromId: account1.id, accountToId: account2.id }).returns(new Transaction(account1, account2, new Money(10)));

const largeTransaction = stub(Transaction, 'fromJson');
largeTransaction.withArgs({ amount: 99999, accountFromId: account1.id, accountToId: account2.id }).returns(new Transaction(account1, account2, new Money(99999)));

const transactions = [smallTransaction(), smallTransaction(), largeTransaction()];

expect(fraudDetection.detectFraudFromTransactions(transactions)).toBe(true);
});
});
