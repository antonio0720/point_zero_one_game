import { Transactions } from "../../transactions";
import { FraudDetectionEngineV8 } from "../fraud-detection-v8";

describe("Economy engine - fraud-detection-8", () => {
let transactions: Transactions;
let fraudDetector: FraudDetectionEngineV8;

beforeEach(() => {
transactions = new Transactions();
fraudDetector = new FraudDetectionEngineV8(transactions);
});

it("should correctly detect fraud when transactions are from the same IP", () => {
// Arrange
const transaction1 = {
ipAddress: "123.123.123.123",
amount: 100,
timestamp: Date.now(),
};
transactions.addTransaction(transaction1);

const transaction2 = {
ipAddress: "123.123.123.123",
amount: 200,
timestamp: Date.now() + 1000, // One second after the first transaction
};
transactions.addTransaction(transaction2);

// Act
const result = fraudDetector.checkForFraud();

// Assert
expect(result).toBeTrue();
});

it("should not detect fraud when transactions are from different IPs", () => {
// Arrange
const transaction1 = {
ipAddress: "123.123.123.123",
amount: 100,
timestamp: Date.now(),
};
transactions.addTransaction(transaction1);

const transaction2 = {
ipAddress: "456.456.456.456",
amount: 200,
timestamp: Date.now() + 1000, // One second after the first transaction
};
transactions.addTransaction(transaction2);

// Act
const result = fraudDetector.checkForFraud();

// Assert
expect(result).toBeFalse();
});

it("should not detect fraud when there is only one transaction", () => {
// Arrange
const transaction1 = {
ipAddress: "123.123.123.123",
amount: 100,
timestamp: Date.now(),
};
transactions.addTransaction(transaction1);

// Act
const result = fraudDetector.checkForFraud();

// Assert
expect(result).toBeFalse();
});
});
