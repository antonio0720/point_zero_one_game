import { FraudDetection5 } from '../fraud-detection-5';
import { TransactionData } from '../transaction-data';

describe('Economy engine - fraud-detection-5', () => {
let fraudDetection: FraudDetection5;

beforeEach(() => {
fraudDetection = new FraudDetection5();
});

test('Should detect fraud when total amount exceeds limit', () => {
const transactionData1 = new TransactionData(1, 'User1', 500);
const transactionData2 = new TransactionData(2, 'User1', 500);
const transactionData3 = new TransactionData(3, 'User1', 500);

expect(fraudDetection.detectFraud([transactionData1, transactionData2, transactionData3])).toBe(true);
});

test('Should not detect fraud when total amount is below limit', () => {
const transactionData1 = new TransactionData(1, 'User1', 400);
const transactionData2 = new TransactionData(2, 'User1', 400);
const transactionData3 = new TransactionData(3, 'User1', 400);

expect(fraudDetection.detectFraud([transactionData1, transactionData2, transactionData3])).toBe(false);
});

// Add more test cases as needed
});
