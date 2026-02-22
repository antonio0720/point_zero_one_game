import { FraudDetection9Service } from "../src/services/fraud-detection-9.service";
import { FraudDetectorResponse } from "../src/interfaces/fraud-detector-response.interface";
import { createMock, MockFunction } from "@golevelup/ts-jest";
import { Transaction } from "../src/interfaces/transaction.interface";
import { FraudDetection9Strategy } from "../src/strategies/fraud-detection-9.strategy";
import { StrategyRegistry } from "../src/services/strategy-registry.service";
import { StrategyFactory } from "../src/services/strategy-factory.service";

describe('Fraud Detection 9', () => {
let fraudDetectionService: FraudDetection9Service;
const mockStrategyRegistry: MockFunction<StrategyRegistry> = createMock(StrategyRegistry);
const mockStrategyFactory: MockFunction<StrategyFactory> = createMock(StrategyFactory);

beforeEach(() => {
fraudDetectionService = new FraudDetection9Service(mockStrategyRegistry.instance, mockStrategyFactory.instance);
});

describe('when creating a transaction', () => {
let transaction: Transaction;

beforeEach(() => {
transaction = {} as Transaction;
});

it('should return false when the amount is less than 1000', () => {
transaction.amount = 999;
mockStrategyRegistry.instance.getStrategyByName.mockReturnValue(jest.fn().mockReturnValue(new FraudDetection9Strategy()));
const result: FraudDetectorResponse = fraudDetectionService.detectFraud(transaction);
expect(result.isFraudulent).toBe(false);
});

it('should return true when the amount is greater than 1000 and the number of transactions in the last 30 days is more than 5', () => {
transaction.amount = 2000;
mockStrategyRegistry.instance.getStrategyByName.mockReturnValue(jest.fn().mockReturnValue(new FraudDetection9Strategy()));
const currentDate = new Date();
const thirtyDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
transaction.timestamp = thirtyDaysAgo;
mockStrategyFactory.instance.createStrategy.mockReturnValue(new FraudDetection9Strategy());
const strategy = mockStrategyRegistry.instance.getStrategyByName.mock.calls[0][0];
strategy.getNumberOfTransactionsInLastNdays.mockReturnValue(6);
const result: FraudDetectorResponse = fraudDetectionService.detectFraud(transaction);
expect(result.isFraudulent).toBe(true);
});
});
});
