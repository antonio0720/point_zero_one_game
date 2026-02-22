import { expect } from 'chai';
import { fraudDetectionFour } from '../fraud-detection-4';

describe('Fraud Detection 4', () => {
it('should return true for a valid transaction', () => {
const transactionData = {
amount: 100,
type: 'debit',
account: {
balance: 200,
},
};

expect(fraudDetectionFour(transactionData)).to.be.true;
});

it('should return false for an invalid transaction with insufficient funds', () => {
const transactionData = {
amount: 200,
type: 'debit',
account: {
balance: 100,
},
};

expect(fraudDetectionFour(transactionData)).to.be.false;
});

it('should return false for an invalid transaction with high frequency', () => {
const transactionData = {
amount: 50,
type: 'debit',
account: {
balance: 250,
},
frequency: 5, // High transaction frequency
};

expect(fraudDetectionFour(transactionData)).to.be.false;
});

it('should return false for an invalid transaction with inconsistent pattern', () => {
const transactionData = {
amount: [10, 20, 30, 40, 50], // Inconsistent amount pattern
type: 'debit',
account: {
balance: 250,
},
};

expect(fraudDetectionFour(transactionData)).to.be.false;
});
});
