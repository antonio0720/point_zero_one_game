import { Contestant } from "../contestant";
import { trustScoring4 } from "./trust-scoring-4";

describe("Contestant - Trust Scoring 4", () => {
const contestant = new Contestant({
id: "test_contestant",
name: "Test Contestant",
email: "test@example.com",
createdAt: new Date(),
});

it("should calculate trust score correctly", () => {
contestant.setScore({ trust: 10, behavior: 5, activity: 7 });
expect(trustScoring4(contestant)).toEqual(8);
});

it("should handle null or undefined input", () => {
contestant.setScore({});
expect(trustScoring4(contestant)).toEqual(0);

contestant.setScore(null);
expect(trustScoring4(contestant)).toEqual(0);
});

it("should handle negative input", () => {
contestant.setScore({ trust: -1, behavior: 5, activity: 7 });
expect(trustScoring4(contestant)).toEqual(0);
});
});
