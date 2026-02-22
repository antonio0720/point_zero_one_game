import { fraudDetection } from '../fraud-detection';
import { Transaction } from '../../interfaces/transaction.interface';

jest.mock('../../interfaces/transaction.interface');

describe('Economy engine - fraud-detection-10', () => {
const transactionMock: Partial<Transaction> = {};

beforeEach(() => {
// Reset the mock for each test
jest.clearAllMocks();
});

it('should detect fraud when total amount exceeds limit', () => {
transactionMock.amount = 10000;
transactionMock.totalAmount = 50000; // Assuming the limit is 50,000
const result = fraudDetection(transactionMock as Transaction);
expect(result).toBe(true);
});

it('should not detect fraud when total amount does not exceed limit', () => {
transactionMock.amount = 100;
transactionMock.totalAmount = 49999; // Assuming the limit is 50,000
const result = fraudDetection(transactionMock as Transaction);
expect(result).toBe(false);
});
});
