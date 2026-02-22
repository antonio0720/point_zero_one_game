import { FairnessAuditor } from "../../fairness-auditor";
import { Classifier } from "@nlpai/nlpai";
import { expect } from "chai";
import "mocha";

describe("FairnessAuditor", () => {
let fairnessAuditor: FairnessAuditor;
let classifier: Classifier;

beforeEach(() => {
classifier = new Classifier();
fairnessAuditor = new FairnessAuditor(classifier);
});

describe("demographicParity", () => {
it("should return correct demographic parity score for equal positive and negative rates", () => {
// Initialize with data for equal positive and negative rates
const posRateMajority = 0.5;
const negRateMajority = 0.5;
const posRateMinority = 0.5;
const negRateMinority = 0.5;

// Set predictions for majority and minority groups
classifier.predict("majority", "positive").then((result) => {
expect(result.label).to.equal("positive");
expect(result.probability[0]).closeTo(posRateMajority, 0.01);
});
classifier.predict("minority", "positive").then((result) => {
expect(result.label).to.equal("positive");
expect(result.probability[0]).closeTo(posRateMinority, 0.01);
});
classifier.predict("majority", "negative").then((result) => {
expect(result.label).to.equal("negative");
expect(result.probability[1]).closeTo(negRateMajority, 0.01);
});
classifier.predict("minority", "negative").then((result) => {
expect(result.label).to.equal("negative");
expect(result.probability[1]).closeTo(negRateMinority, 0.01);
});

fairnessAuditor.demographicParity().then((score) => {
const expectedScore = (posRateMajority - negRateMajority) / Math.abs(posRateMajority - negRateMajority);
expect(score).to.be.closeTo(expectedScore, 0.1);
});
});

it("should return correct demographic parity score for unequal positive and negative rates", () => {
// Initialize with data for unequal positive and negative rates
const posRateMajority = 0.7;
const negRateMajority = 0.3;
const posRateMinority = 0.4;
const negRateMinority = 0.6;

// Set predictions for majority and minority groups
classifier.predict("majority", "positive").then((result) => {
expect(result.label).to.equal("positive");
expect(result.probability[0]).closeTo(posRateMajority, 0.01);
});
classifier.predict("minority", "positive").then((result) => {
expect(result.label).to.equal("positive");
expect(result.probability[0]).closeTo(posRateMinority, 0.01);
});
classifier.predict("majority", "negative").then((result) => {
expect(result.label).to.equal("negative");
expect(result.probability[1]).closeTo(negRateMajority, 0.01);
});
classifier.predict("minority", "negative").then((result) => {
expect(result.label).to.equal("negative");
expect(result.probability[1]).closeTo(negRateMinority, 0.01);
});

fairnessAuditor.demographicParity().then((score) => {
const expectedScore = (posRateMajority - negRateMajority) / Math.abs(posRateMajority - negRateMajority);
expect(score).to.be.closeTo(-(posRateMinority - negRateMinority) / Math.abs(posRateMinority - negRateMinority), 0.1);
});
});
});
});
