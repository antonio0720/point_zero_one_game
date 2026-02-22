import { EconomyEngine } from "../../economy/economy-engine";
import { FraudDetectionStrategy2 } from "../strategies/fraud-detection-strategy-2";
import { Transaction } from "../../models/transaction";

describe("Economy engine - fraud-detection-2", () => {
let economyEngine: EconomyEngine;

beforeEach(() => {
economyEngine = new EconomyEngine();
economyEngine.registerStrategy(new FraudDetectionStrategy2());
});

it("should mark transaction as fraud when it exceeds limit", () => {
const transaction1 = new Transaction(1, 50);
const transaction2 = new Transaction(2, 51);
economyEngine.processTransaction(transaction1);
economyEngine.processTransaction(transaction2);

expect(economyEngine.getTransaction(transaction1.id).isFraud).toBe(false);
expect(economyEngine.getTransaction(transaction2.id).isFraud).toBe(true);
});

it("should mark transactions as fraud when they happen within a short period", () => {
const transaction1 = new Transaction(1, 10);
const transaction2 = new Transaction(2, 10);
economyEngine.processTransaction(transaction1);
economyEngine.processTransaction(transaction2);

expect(economyEngine.getTransaction(transaction1.id).isFraud).toBe(false);
expect(economyEngine.getTransaction(transaction2.id).isFraud).toBe(true);
});

it("should not mark transactions as fraud if they are below the limit", () => {
const transaction1 = new Transaction(1, 40);
const transaction2 = new Transaction(2, 30);
economyEngine.processTransaction(transaction1);
economyEngine.processTransaction(transaction2);

expect(economyEngine.getTransaction(transaction1.id).isFraud).toBe(false);
expect(economyEngine.getTransaction(transaction2.id).isFraud).toBe(false);
});
});
