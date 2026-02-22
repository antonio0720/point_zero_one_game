import { Balance } from "../balance";
import * as fuzzystring from "fuzzystring";
import "jest";

describe("Balance Testing 1", () => {
it("should correctly add amounts", () => {
const balance = new Balance();
balance.addAmount(10);
balance.addAmount(20);
expect(balance.getTotal()).toBe(30);
});

it("should correctly subtract amounts", () => {
const balance = new Balance();
balance.addAmount(50);
balance.subtractAmount(25);
expect(balance.getTotal()).toBe(25);
});

it("should handle zero amount additions", () => {
const balance = new Balance();
balance.addAmount(0);
expect(balance.getTotal()).toBe(0);
});

it("should return correct balance after adding and subtracting fuzzy amounts", () => {
const balance = new Balance();
balance.addAmount(5);
balance.subtractAmount(fuzzystring.tokenize("twentyfive").join(" ").replace(/ /g, "")); // Replace 'twentyfive' with a fuzzy string
expect(balance.getTotal()).toBeLessThanOrEqual(0);
});
});
