import { Contestant } from "../../contestant";
import { TrustScoringService } from "../trust-scoring.service";
import { TrustScoringAlgorithm8 } from "./trust-scoring-algorithm-8";

describe('Trust Scoring (Algorithm 8)', () => {
let contestant: Contestant;
let trustScoringService: TrustScoringService;

beforeEach(() => {
contestant = new Contestant();
trustScoringService = new TrustScoringService(new TrustScoringAlgorithm8());
});

describe('initial scoring', () => {
it('should initialize the trust score to default value', () => {
expect(trustScoringService.getTrustScore(contestant)).toBe(0);
});
});

describe('scoring after submitting a solution', () => {
let correctSolution: string;
let incorrectSolution: string;

beforeEach(() => {
correctSolution = 'correct solution';
incorrectSolution = 'incorrect solution';
});

it('should increase the trust score for a correct submission', () => {
contestant.submitSolution(correctSolution);
expect(trustScoringService.getTrustScore(contestant)).toBeGreaterThan(0);
});

it('should decrease the trust score for an incorrect submission', () => {
contestant.submitSolution(incorrectSolution);
expect(trustScoringService.getTrustScore(contestant)).toBeLessThan(0);
});
});

describe('scoring after a penalty', () => {
it('should decrease the trust score for a penalty', () => {
contestant.applyPenalty();
expect(trustScoringService.getTrustScore(contestant)).toBeLessThan(0);
});
});
});
