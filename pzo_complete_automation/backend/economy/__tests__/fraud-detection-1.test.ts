import { FraudDetection1 } from '../fraud-detection-1';
import { Transaction } from '../../interfaces/transaction.interface';

describe('Economy engine - fraud-detection-1', () => {
let fraudDetector: FraudDetection1;

beforeEach(() => {
fraudDetector = new FraudDetection1();
});

it('should detect fraud when total amount exceeds limit', () => {
const transactions: Transaction[] = [
{ id: 1, amount: 500 },
{ id: 2, amount: 600 },
];

expect(fraudDetector.isFraudulent(transactions)).toBe(true);
});

it('should not detect fraud when total amount is below limit', () => {
const transactions: Transaction[] = [
{ id: 1, amount: 400 },
{ id: 2, amount: 300 },
];

expect(fraudDetector.isFraudulent(transactions)).toBe(false);
});
});
