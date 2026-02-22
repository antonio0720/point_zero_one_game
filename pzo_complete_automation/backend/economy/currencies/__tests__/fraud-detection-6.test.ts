import { EconomyEngine } from '../../../economy';
import { FraudDetectionStrategy6 } from './fraud-detection-strategy-6';
import { Transaction } from '../../transaction';

describe('Economy engine - fraud-detection-6', () => {
let economyEngine: EconomyEngine;

beforeEach(() => {
economyEngine = new EconomyEngine();
economyEngine.addFraudDetectionStrategy(new FraudDetectionStrategy6());
});

it('should correctly detect fraud for transaction with six consecutive identical digits', () => {
const transaction1 = new Transaction(100, '4242424242424246');
const transaction2 = new Transaction(50, '1234567890123456');

economyEngine.processTransaction(transaction1);
economyEngine.processTransaction(transaction2);

expect(economyEngine.hasFraudDetected()).toBeTruthy();
});

it('should not detect fraud for transaction with less than six consecutive identical digits', () => {
const transaction1 = new Transaction(100, '4242424242424236');
const transaction2 = new Transaction(50, '1234567890123456');

economyEngine.processTransaction(transaction1);
economyEngine.processTransaction(transaction2);

expect(economyEngine.hasFraudDetected()).toBeFalsy();
});
});
