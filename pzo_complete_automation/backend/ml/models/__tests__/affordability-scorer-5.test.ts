import { AffordabilityScorer5 } from "../affordability-scorer-5";
import { IAffordabilityScorerConfig } from "../../interfaces/IAffordabilityScorerConfig";
import { IAffordabilityScorerInput } from "../../interfaces/IAffordabilityScorerInput";
import { expect } from "chai";
import "mocha";

describe("AffordabilityScorer5", () => {
let affordabilityScorer: AffordabilityScorer5;

beforeEach(() => {
const config: IAffordabilityScorerConfig = { /* your configuration here */ };
affordabilityScorer = new AffordabilityScorer5(config);
});

it("should correctly score affordability", () => {
// Given
const input: IAffordabilityScorerInput = { /* your test input here */ };
const expectedScore = /* your expected output here */;

// When
const actualScore = affordabilityScorer.score(input);

// Then
expect(actualScore).to.equal(expectedScore);
});

it("should handle invalid inputs", () => {
// Given
const invalidInputs: IAffordabilityScorerInput[] = [/* your test invalid inputs here */];

// When & Then
invalidInputs.forEach((input) => {
expect(() => affordabilityScorer.score(input)).to.throw(/Invalid input/);
});
});
});
