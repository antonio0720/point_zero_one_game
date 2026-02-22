import { Receipt } from "../receipts";
import { ValidationError } from "../validation-error";

describe("Receipt", () => {
describe("validate", () => {
it("should return an error if the total is not a number", () => {
const receipt = new Receipt("ID-123", ["Item 1", "Item 2"], "John Doe", 10, "EUR", "Invalid total");

expect(Receipt.validate(receipt)).toEqual(new ValidationError("Total should be a number"));
});

it("should return an error if the total is negative", () => {
const receipt = new Receipt("ID-123", ["Item 1", "Item 2"], "John Doe", -10, "EUR", "Valid total");

expect(Receipt.validate(receipt)).toEqual(new ValidationError("Total should be positive"));
});

it("should return an error if the currency is not supported", () => {
const receipt = new Receipt("ID-123", ["Item 1", "Item 2"], "John Doe", 10, "USD", "Valid total");

// Assuming that only EUR is supported for this example
expect(Receipt.validate(receipt)).toEqual(new ValidationError("Unsupported currency"));
});

it("should return null if the receipt is valid", () => {
const receipt = new Receipt("ID-123", ["Item 1", "Item 2"], "John Doe", 10, "EUR", "Valid total");

expect(Receipt.validate(receipt)).toBeNull();
});
});
});
