import { validateDeck, Deck } from "../validation/validation-4";
import { expect } from "chai";

describe("Deck reactor - validation-4", () => {
it("validates a valid deck correctly", () => {
const validDeck: Deck = {
name: "Test Deck",
cards: [
{ id: "1", type: "ATTACK", cost: 2, effect: "Increase attack by 3" },
// Add more valid card examples as needed
],
};

const result = validateDeck(validDeck);
expect(result).to.be.true;
});

it("throws an error for invalid deck", () => {
const invalidDeck: Deck = {
name: "Invalid Deck",
cards: [], // or any other invalid structure
};

expect(() => validateDeck(invalidDeck)).to.throw;
});
});
